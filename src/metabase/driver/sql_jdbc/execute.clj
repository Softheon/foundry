
(ns metabase.driver.sql-jdbc.execute
  "Code related to actually running a SQL query against a JDBC database (including setting the session timezone when
  appropriate), and for properly encoding/decoding types going in and out of the database."
  (:require [clojure.java.jdbc :as jdbc]
            [clojure.tools.logging :as log]
            [clojure.core.async :as a]
            [metabase
             [driver :as driver]
             [util :as u]]
            [metabase.driver.sql-jdbc.connection :as sql-jdbc.conn]
            [metabase.mbql.util :as mbql.u]
            [metabase.query-processor
             [interface :as qp.i]
             [store :as qp.store]
             [util :as qputil]]
            [metabase.util
             [date :as du]
             [honeysql-extensions :as hx]
             [i18n :refer [tru]]]
            [metabase.java.jdbc :as f-jdbc]
            [metabase.models.setting :as setting])
  (:import [java.sql PreparedStatement ResultSet ResultSetMetaData SQLException Types]
           [java.util Calendar Date TimeZone]))

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                            Interface (Multimethods)                                            |
;;; +----------------------------------------------------------------------------------------------------------------+

(defmulti set-timezone-sql
  "Return a format string containing a SQL statement to be used to set the timezone for the current transaction.
  The `%s` will be replaced with a string literal for a timezone, e.g. `US/Pacific.`

    \"SET @@session.timezone = %s;\""
  {:arglists '([driver])}
  driver/dispatch-on-initialized-driver
  :hierarchy #'driver/hierarchy)

(defmethod set-timezone-sql :sql-jdbc [_] nil)


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                Parsing Results                                                 |
;;; +----------------------------------------------------------------------------------------------------------------+

(defn parse-date-as-string
  "Most databases will never invoke this code. It's possible with SQLite to get here if the timestamp was stored
  without milliseconds. Currently the SQLite JDBC driver will throw an exception even though the SQLite datetime
  functions will return datetimes that don't include milliseconds. This attempts to parse that datetime in Clojure
  land"
  [^Calendar cal, ^ResultSet rs, ^Integer i]
  (let [date-string (.getString rs i)]
    (if-let [parsed-date (du/str->date-time date-string (.getTimeZone cal))]
      parsed-date
      (throw (Exception. (str (tru "Unable to parse date ''{0}''" date-string)))))))

(defmulti read-column
  "Read a single value from a single column in a single row from the JDBC ResultSet of a Foundry query. Normal
  implementations call an appropriate method on `ResultSet` to retrieve this value, such as `(.getObject resultset
  i)`. (`i` is the index of the column whose value you should retrieve.)

  This method provides the opportunity to customize behavior for the way a driver returns or formats results of
  certain types -- this method dispatches on both driver and column type. For example, the MySQL/MariaDB driver
  provides a custom implementation for `Types/TIME` to work around questionable Timezone support.

  If set, the report timezone active at the time the query was ran will be passed as a Calendar; otherwise this value
  will be `nil` -- be sure to check before doing anything crazy with it."
  {:arglists '([driver calendar resultset resultset-metadata i])}
  (fn [driver _ _, ^ResultSetMetaData resultset-metadata, ^Integer i]
    [(driver/dispatch-on-initialized-driver driver) (.getColumnType resultset-metadata i)])
  :hierarchy #'driver/hierarchy)

(defmethod read-column :default [_ _, ^ResultSet resultset, _, ^Integer i]
  (.getObject resultset i))

(defmethod read-column [::driver/driver Types/DATE] [_, ^Calendar cal, ^ResultSet resultset, _, ^Integer i]
  (if-not cal
    (.getObject resultset i)
    (try
      (.getDate resultset i cal)
      (catch SQLException e
        (parse-date-as-string cal resultset i)))))

(defmethod read-column [::driver/driver Types/TIMESTAMP] [_, ^Calendar cal, ^ResultSet resultset, _, ^Integer i]
  (if-not cal
    (.getObject resultset i)
    (try
      (.getTimestamp resultset i cal)
      (catch SQLException e
        (parse-date-as-string cal resultset i)))))

(defmethod read-column [::driver/driver Types/TIME] [driver, _, ^ResultSet resultset, _, ^Integer i]
  ;; .getTime will be something like 1970-01-01-09:14:00 when it comes back from the DB for normal DBs (i.e., already
  ;; in UTC), so always pass in UTC Calendar -- otherwise the normal behavior is to try to apply the default calendar,
  ;; which uses the default timezone, which is either the report timezone or system timezone, and not what we want.
  ;; Otherwise our times will be incorrectly shifted.
  ;;
  ;; Only apply this shift for drivers that support timezones (e.g. Postgres) -- other drivers like H2 should already
  ;; be in the correct timezone
  (if (driver/supports? driver :set-timezone)
    (.getTime resultset i (Calendar/getInstance (TimeZone/getTimeZone "UTC")))
    (.getObject resultset i)))


(defmulti read-columns
  "Return a function that will be used to read a row from a ResultSet, passed to Clojure JDBC as the `:read-columns`
  argument. Returned function should take three args: `resultset`, `resultset-metadata`, and `indexes`, and return a
  sequence of results. Default implementation calls `read-column` and passes results to `jdbc/result-set-read-column`.

  This method provides a low-level opportunity to transform the shape of the results as a whole, e.g. by removing
  extraneous columns from the results or adding missing ones. If you only want to override behavior for a single
  type (e.g., convert bits to booleans), implement `read-column` instead."
  {:arglists '([driver calendar])}
  driver/dispatch-on-initialized-driver
  :hierarchy #'driver/hierarchy)

(defmethod read-columns :default [driver, ^Calendar calendar]
  (fn [^ResultSet resultset, ^ResultSetMetaData resultset-metadata, indexes]
    (for [^Integer i, indexes]
      (jdbc/result-set-read-column (read-column driver calendar resultset resultset-metadata i) resultset-metadata i))))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                 Setting Params                                                 |
;;; +----------------------------------------------------------------------------------------------------------------+

;; TODO - this should be a multimethod like `read-column`. Perhaps named `set-parameter`
(defn- set-parameters-with-timezone
  "Returns a function that will set date/timestamp PreparedStatement
  parameters with the correct timezone"
  [^TimeZone tz]
  (fn [^PreparedStatement stmt params]
    (mapv (fn [^Integer i value]
            (cond

              (and tz (instance? java.sql.Time value))
              (.setTime stmt i value (Calendar/getInstance tz))

              (and tz (instance? java.sql.Timestamp value))
              (.setTimestamp stmt i value (Calendar/getInstance tz))

              (and tz (instance? java.util.Date value))
              (.setDate stmt i value (Calendar/getInstance tz))

              :else
              (jdbc/set-parameter value stmt i)))
          (rest (range)) params)))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                Running Queries                                                 |
;;; +----------------------------------------------------------------------------------------------------------------+

;; TODO - this is pretty similar to what `jdbc/with-db-connection` does, but not exactly the same. See if we can
;; switch to using that instead?
(defn- do-with-ensured-connection [db f]
  (if-let [conn (jdbc/db-find-connection db)]
    (f conn)
    (with-open [conn (jdbc/get-connection db)]
      (f conn))))

(defn- close-quietly
  [object]
  (when (some? object)
    (try
      (.close object)
      (catch Throwable e
        (log/error e)))))

(defmacro ^:private with-ensured-connection
  "In many of the clojure.java.jdbc functions, it checks to see if there's already a connection open before opening a
  new one. This macro checks to see if one is open, or will open a new one. Will bind the connection to `conn-sym`."
  {:style/indent 1}
  [[conn-binding db] & body]
  `(do-with-ensured-connection ~db (fn [~conn-binding] ~@body)))

(defn ^:private cancellable-query
  [conn stmt params opts canceled-chan]
  (a/go-loop []
    (try

      (let [run-query-chan (a/go
                             (try
                               (f-jdbc/query-with-limited-resultset conn (into [stmt] params) opts)
                               (catch Throwable e
                                 e)))
            [value port] (a/alts! [run-query-chan canceled-chan])]
        (if (= port canceled-chan)
          (throw (InterruptedException. "Client has canceled the request."))
          value))
      (catch Throwable e
        e))))


(defn- cancelable-run-query
  "Runs JDBC query, canceling it if an InterruptedException is caught (e.g. if there query is canceled
before finishing)."
  [db sql params opts canceled-chan]
  (with-ensured-connection [conn db]
    ;; This is normally done for us by java.jdbc as a result of our `jdbc/query` call
    (with-open [^PreparedStatement stmt (jdbc/prepare-statement conn sql opts)]
      ;; specifiy that we'd like this statement to close once its dependent result sets are closed
      ;; (Not all drivers support this so ignore Exceptions if they don't)
      (u/ignore-exceptions
       (.closeOnCompletion stmt))
      ;; Need to run the query in another thread so that this thread can cancel it if need be
      (try
        ;; (jdbc/query conn (into [stmt] params) opts)
        ;; (log/info "\n---- sql \n", sql)
        ;; (log/info "\n ----prepared statment\n\n " stmt)
        ;; (log/info "\n --- parameters \n", params)
        (let [result-chan (cancellable-query conn stmt params opts canceled-chan)
              result (a/<!! result-chan)]
          (when (instance? java.lang.InterruptedException (class result))
            (throw result))
          (if (instance? Throwable result)
            (throw result)
            result))
        (catch Exception e
          (try
            (log/warn (tru "Client closed connection, canceling query"))
            (log/error e)
            ;; This is what does the real work of canceling the query. We aren't checking the result of
          ;; `query-future` but this will cause an exception to be thrown, saying the query has been cancelled.
            (.cancel stmt)
            (.rollback conn)
            (finally
              (throw e))))))))

(defn- run-query
  "Run the query itself."
  [driver {sql :query, :keys [params remark max-rows canceled-chan]}, ^TimeZone timezone, connection]
  (let [sql              (str "-- " remark "\n" (hx/unescape-dots sql))
        [columns & rows] (cancelable-run-query
                          connection sql params
                          {:identifiers    identity
                           :timeout (setting/get :query-timeout)
                           :as-arrays?     true
                           :limited max-rows
                           :read-columns   (read-columns driver (some-> timezone Calendar/getInstance))
                           :set-parameters (set-parameters-with-timezone timezone)}
                          canceled-chan)]
    {:rows    (or (if (= max-rows 0)
                    rows
                    (take max-rows rows))
                  [])
     :columns (map u/keyword->qualified-name columns)}))


;;; -------------------------- Running queries: exception handling & disabling auto-commit ---------------------------

(defn- exception->nice-error-message ^String [^SQLException e]
  ;; error message comes back like 'Column "ZID" not found; SQL statement: ... [error-code]' sometimes
  ;; the user already knows the SQL, and error code is meaningless
  ;; so just return the part of the exception that is relevant
  (->> (.getMessage e)
       (re-find #"^(.*);")
       second))

(defn do-with-try-catch
  "Tries to run the function `f`, catching and printing exception chains if SQLException is thrown,
  and rethrowing the exception as an Exception with a nicely formatted error message."
  {:style/indent 0}
  [f]
  (try
    (f)
    (catch SQLException e
      (log/error (jdbc/print-sql-exception-chain e))
      (throw
       (if-let [nice-error-message (exception->nice-error-message e)]
         (Exception. nice-error-message e)
         e)))))

(defn- do-with-auto-commit-disabled
  "Disable auto-commit for this transaction, and make the transaction `rollback-only`, which means when the
  transaction finishes `.rollback` will be called instead of `.commit`. Furthermore, execute F in a try-finally block;
  in the `finally`, manually call `.rollback` just to be extra-double-sure JDBC any changes made by the transaction
  aren't committed."
  {:style/indent 1}
  [conn f]
  (jdbc/db-set-rollback-only! conn)
  (.setAutoCommit (jdbc/get-connection conn) false)
  ;; TODO - it would be nice if we could also `.setReadOnly` on the transaction as well, but that breaks setting the
  ;; timezone. Is there some way we can have our cake and eat it too?
  (try
    (f)
    (finally (.rollback (jdbc/get-connection conn)))))

(defn- do-with-auto-commit-disabled-for-exporting
  "Disable auto-commit for this transaction, and make the transaction `rollback-only`, which means when the
  transaction finishes `.rollback` will be called instead of `.commit`. Furthermore, execute F in a try-finally block;
  in the `finally`, manually call `.rollback` just to be extra-double-sure JDBC any changes made by the transaction
  aren't committed."
  {:style/indent 1}
  [conn f]
  (jdbc/db-set-rollback-only! conn)
  (.setAutoCommit (jdbc/get-connection conn) false)
  ;; TODO - it would be nice if we could also `.setReadOnly` on the transaction as well, but that breaks setting the
  ;; timezone. Is there some way we can have our cake and eat it too?
  (f))

(defn- do-in-transaction [connection f]
  (jdbc/with-db-transaction [transaction-connection connection {:isolation :read-uncommitted}]
    (log/info "running query within the transaction.")
    (do-with-auto-commit-disabled transaction-connection (partial f transaction-connection))))


;;; ---------------------------------------------- Running w/ Timezone -----------------------------------------------

(defn- set-timezone!
  "Set the timezone for the current connection."
  {:arglists '([driver settings connection])}
  [driver {:keys [report-timezone]} connection]
  (let [timezone      (u/prog1 report-timezone
                               (assert (re-matches #"[A-Za-z\/_]+" <>)))
        format-string (set-timezone-sql driver)
        sql           (format format-string (str \' timezone \'))]
    (log/debug (u/format-color 'green (tru "Setting timezone with statement: {0}" sql)))
    (jdbc/db-do-prepared connection [sql])))

(defn- run-query-without-timezone [driver _ connection query]
  (if (:run-query-within-transaction query)
    (do-in-transaction connection (partial run-query driver query nil))
    (run-query driver query nil connection)))

(defn- run-query-with-timezone [driver {:keys [^String report-timezone] :as settings} connection query] 
  (try
    (if (:run-query-within-transaction query)
      (do-in-transaction connection (fn [transaction-connection]
                                      (set-timezone! driver settings transaction-connection)
                                      (run-query driver
                                                 query
                                                 (some-> report-timezone TimeZone/getTimeZone)
                                                 transaction-connection)))
      (run-query driver
                 query
                 (some-> report-timezone TimeZone/getTimeZone)
                 connection))

    (catch SQLException e
      (log/error (tru "Failed to set timezone:") "\n" (with-out-str (jdbc/print-sql-exception-chain e)))
      (run-query-without-timezone driver settings connection query))
    (catch Throwable e
      (log/error (tru "Failed to set timezone:") "\n" (.getMessage e))
      (run-query-without-timezone driver settings connection query))))


;;; ------------------------------------------------- execute-query --------------------------------------------------

(defn execute-query
  "Process and run a native (raw SQL) QUERY."
  [driver {settings :settings, query :native, info :info, :as outer-query}]
  (let [query (assoc query
                     :remark   (qputil/query->remark outer-query)
                     :max-rows (or (mbql.u/query->max-rows-limit outer-query) qp.i/absolute-max-results)
                     :run-query-within-transaction (get-in info [:run-query-within-transaction] true))
        canceled-chan (:canceled-chan outer-query)]
    (do-with-try-catch
     (fn []
       (let [db-connection (sql-jdbc.conn/db->pooled-connection-spec (qp.store/database))]
         ((if (seq (:report-timezone settings))
            run-query-with-timezone
            run-query-without-timezone) driver settings db-connection (assoc query :canceled-chan canceled-chan)))))))

;;; ------------------------------------------------- stream-query --------------------------------------------------
(defn- do-without-auto-close-ensured-connection [db f]
  (if-let [conn (jdbc/db-find-connection db)]
    (f conn)
    (let [conn (jdbc/get-connection db)]
      (f conn))))

(defmacro ^:private with-ensured-connection-without-auto-close
  "In many of the clojure.java.jdbc functions, it checks to see if there's already a connection open before opening a
  new one. This macro checks to see if one is open, or will open a new one. Will bind the connection to `conn-sym`."
  {:style/indent 1}
  [[conn-binding db] & body]
  `(do-without-auto-close-ensured-connection ~db (fn [~conn-binding] ~@body)))

;; (defn- cancelable-run-query
;;   "Runs `sql` in such a way that it can be interrupted via a `future-cancel`"
;;   [db sql params opts]
;;   (with-ensured-connection [conn db]
;;     ;; This is normally done for us by java.jdbc as a result of our `jdbc/query` call
;;     (with-open [^PreparedStatement stmt (jdbc/prepare-statement conn sql opts)]
;;       ;; specifiy that we'd like this statement to close once its dependent result sets are closed
;;       ;; (Not all drivers support this so ignore Exceptions if they don't)
;;       (u/ignore-exceptions
;;        (.closeOnCompletion stmt))
;;       ;; Need to run the query in another thread so that this thread can cancel it if need be
;;       (try
;;         (let [query-future (future (jdbc/query conn (into [stmt] params) opts))]
;;           ;; This thread is interruptable because it's awaiting the other thread (the one actually running the
;;           ;; query). Interrupting this thread means that the client has disconnected (or we're shutting down) and so
;;           ;; we can give up on the query running in the future
;;           @query-future)
;;         (catch InterruptedException e
;;           (log/warn (tru "Client closed connection, canceling query"))
;;           ;; This is what does the real work of canceling the query. We aren't checking the result of
;;           ;; `query-future` but this will cause an exception to be thrown, saying the query has been cancelled.
;;           (.cancel stmt)
;;           (throw e))))))


(defn- cancellable-run-query-for-download
  "Runs `sql` in such a way that it can be interrupted via a `future-cancel`"
  [db sql params opts]
  (with-ensured-connection-without-auto-close [conn db]
    ;; This is normally done for us by java.jdbc as a result of our `jdbc/query` call
    (let [^PreparedStatement stmt (jdbc/prepare-statement conn sql opts)]
      ;; Need to run the query in another thread so that this thread can cancel it if need be
      (u/ignore-exceptions
       (.closeOnCompletion stmt))
      (try
        ;; (let [query-future (future (f-jdbc/steaming-download-query conn (into [stmt] params) opts))]
        ;;   ;; This thread is interruptable because it's awaiting the other thread (the one actually running the
        ;;   ;; query). Interrupting this thread means that the client has disconnected (or we're shutting down) and so
        ;;   ;; we can give up on the query running in the future
        ;;   @query-future)
        (f-jdbc/steaming-download-query conn (into [stmt] params) opts)
        (catch Throwable e
          (try
            (log/warn e "Client closed connection, cancelling downloading query")
          ;; This is what does the real work of cancelling the query. We aren't checking the result of
          ;; `query-future` but this will cause an exception to be thrown, saying the query has been cancelled.
            (close-quietly stmt)
            (close-quietly conn)
            (catch Throwable e
              (log/warn e "unable to cancel downloading query")
              (close-quietly stmt)
              (close-quietly conn)
              (throw e))))))))

(defn- query-stream
  "Run the query itself."
  [driver {sql :query, :keys [params remark max-rows]}, ^TimeZone timezone, settings, export-fn, connection]
  (let [sql              (str "-- " remark "\n" (hx/unescape-dots sql))
        stream (cancellable-run-query-for-download
                connection sql params
                {:identifiers    identity
                 :as-arrays?     true
                 :read-columns   (read-columns driver (some-> timezone Calendar/getInstance))
                 :set-parameters (set-parameters-with-timezone timezone)
                 :result-set-fn (export-fn connection settings)
                 :timeout (setting/get :query-timeout)
                           ;:concurrency :read-only
                 :keywordize? false})]
    stream))

(defn- do-in-transaction-stream [connection f]
  (f-jdbc/with-db-transaction-without-auto-close [transaction-connection connection {:isolation :read-uncommitted}]
    (log/info "running query within the transaction.")
    (do-with-auto-commit-disabled-for-exporting transaction-connection (partial f transaction-connection))))

(defn- run-query-without-timezone-stream [driver settings connection query export-fn]
  (do-in-transaction-stream connection (partial query-stream driver query nil settings export-fn)))

(defn stream-query
  "Process and run a native (raw SQL) QUERY,and returns a result stream."
  [driver
   {settings :settings,
    query :native,
    {:keys [export-fn]} :middleware,
    visualization-settings :visualization-settings,
    enable-excel-conditional-formatting :enable-excel-conditional-formatting
    info :info
    :as outer-query}]
  (let [query query]
    (do-with-try-catch
     (fn []
       (let [db-connection (sql-jdbc.conn/db->pooled-connection-spec (qp.store/database))
             canceled-chan (:canceled-chan outer-query)
             run-query-within-transaction (get-in info [:run-query-within-transaction] true)]
         (if run-query-within-transaction
           (run-query-without-timezone-stream driver
                                              (assoc settings
                                                     :visualization-settings visualization-settings
                                                     :enable-excel-conditional-formatting enable-excel-conditional-formatting
                                                     :csv-buffer-size (:csv-buffer-size outer-query))
                                              db-connection (assoc query :canceled-chan canceled-chan) export-fn)
           (query-stream driver query nil settings export-fn db-connection)))))))
