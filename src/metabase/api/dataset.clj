(ns metabase.api.dataset
  "/api/dataset endpoints."
  (:require [cheshire.core :as json]
            [clojure.core.async :as a]
            [clojure.string :as str]
            [clojure.tools.logging :as log]
            [compojure.core :refer [POST]]
            [medley.core :as m]
            [metabase.api.common :as api]
            [metabase.models
             [card :refer [Card]]
             [database :as database :refer [Database]]
             [query :as query]]
            [metabase.query-processor
             [async :as qp.async]
             [util :as qputil]]
            [metabase.query-processor.middleware.constraints :as constraints]
            [metabase.util
             [date :as du]
             [export :as ex]
             [i18n :refer [trs tru]]
             [schema :as su]]
            [schema.core :as s]
            [metabase.public-settings :as public-settings]
            [metabase.models.setting :as setting])
  (:import clojure.core.async.impl.channels.ManyToManyChannel))

(defn append-database-name
  [name database-id]
  (try
    (str name " - " (:name (Database database-id) "Unknown Environment"))
    (catch Throwable e
      (log/error e))))

(defn append-db-name-if-needed-given-card-id
  "Append a card's source database name to the given name if the setting `enable-appending-env-name-to-regular-report-file` 
   is true."
  [name id]
  (try
    (let [card (Card id)]
      (if (public-settings/enable-appending-env-name-to-regular-report-file)
        (append-database-name name (:database_id card))
        name))
    (catch Throwable _
      (log/error _)
      name)))

(defn append-db-name-if-needed-given-database-id
  "Append  source database name to the given name if the setting `enable-appending-env-name-to-regular-report-file` 
   is true."
  [name id]
  (try
    (if (public-settings/enable-appending-env-name-to-regular-report-file)
      (append-database-name name id)
      name)
    (catch Throwable _
      (log/error _)
      name)))
;;; -------------------------------------------- Running a Query Normally --------------------------------------------

(defn- query->source-card-id
  "Return the ID of the Card used as the \"source\" query of this query, if applicable; otherwise return `nil`. Used so
  `:card-id` context can be passed along with the query so Collections perms checking is done if appropriate. This fn
  is a wrapper for the function of the same name in the QP util namespace; it adds additional permissions checking as
  well."
  [outer-query]
  (when-let [source-card-id (qputil/query->source-card-id outer-query)]
    (log/info (trs "Source query for this query is Card {0}" source-card-id))
    (api/read-check Card source-card-id)
    source-card-id))

(api/defendpoint POST "/"
  "Execute a query and retrieve the results in the usual format."
  [:as {{:keys [database], :as query} :body}]
  {database s/Int}
  ;; don't permissions check the 'database' if it's the virtual database. That database doesn't actually exist :-)
  (when-not (= database database/virtual-id)
    (api/read-check Database database))
  ;; add sensible constraints for results limits on our query
  (let [source-card-id (query->source-card-id query)
        options        {:executed-by api/*current-user-id*, :context :ad-hoc
                        :card-id     source-card-id,        :nested? (boolean source-card-id)}]
    (qp.async/process-query-and-save-with-max-results-constraints! query options)))


;;; ----------------------------------- Downloading Query Results in Other Formats -----------------------------------

(def ExportFormat
  "Schema for valid export formats for downloading query results."
  (apply s/enum (keys ex/export-formats)))

(defn export-format->context
  "Return the `:context` that should be used when saving a QueryExecution triggered by a request to download results
  in EXPORT-FORAMT.

    (export-format->context :json) ;-> :json-download"
  [export-format]
  (or (get-in ex/export-formats [export-format :context])
      (throw (Exception. (str (tru "Invalid export format: {0}" export-format))))))

(defn- datetime-str->date
  "Dates are iso formatted, i.e. 2014-09-18T00:00:00.000-07:00. We can just drop the T and everything after it since
  we don't want to change the timezone or alter the date part. SQLite dates are not iso formatted and separate the
  date from the time using a space, this function handles that as well"
  [^String date-str]
  (if-let [time-index (and (string? date-str)
                           ;; clojure.string/index-of returns nil if the string is not found
                           (or (str/index-of date-str "T")
                               (str/index-of date-str " ")))]
    (subs date-str 0 time-index)
    date-str))

(defn- swap-date-columns [date-col-indexes]
  (fn [row]
    (reduce (fn [acc idx]
              (update acc idx datetime-str->date)) row date-col-indexes)))

(defn- date-column-indexes
  "Given `column-metadata` find the `:type/Date` columns"
  [column-metadata]
  (transduce (comp (map-indexed (fn [idx col-map] [idx (:base_type col-map)]))
                   (filter (fn [[idx base-type]] (isa? base-type :type/Date)))
                   (map first))
             conj [] column-metadata))

(defn- maybe-modify-date-values [column-metadata rows]
  (let [date-indexes (date-column-indexes column-metadata)]
    (if (seq date-indexes)
      ;; Not sure why, but rows aren't vectors, they're lists which makes updating difficult
      (map (comp (swap-date-columns date-indexes) vec) rows)
      rows)))

(defn- as-format-response
  "Return a response containing the `results` of a query in the specified format."
  {:style/indent 1, :arglists '([export-format results])}
  [export-format name {{:keys [columns rows cols]} :data, :keys [status], :as response}]
  (api/let-404 [export-conf (ex/export-formats export-format)]
               (if (= status :completed)
      ;; successful query, send file
                 {:status  200
                  :body    ((:export-fn export-conf) columns (maybe-modify-date-values cols rows))
                  :headers {"Content-Type"        (str (:content-type export-conf) "; charset=utf-8")
                ;;  "Content-Disposition" (str "attachment; filename=\"query_result_" (du/date->iso-8601) "." (:ext export-conf) "\"")}}
                            "Content-Disposition" (str "attachment; filename=\"" name "." (:ext export-conf) "\"")}}
      ;; failed query, send error message
                 {:status 500
                  :body   (:error response)})))

(s/defn as-format-async
  "Write the results of an async query to API `respond` or `raise` functions in `export-format`. `in-chan` should be a
  core.async channel that can be used to fetch the results of the query."
  {:style/indent 3}
  [export-format :- ExportFormat, name, respond :- (s/pred fn?), raise :- (s/pred fn?), in-chan :- ManyToManyChannel]
  (a/go
    (try
      (let [results (a/<! in-chan)]
        (if (instance? Throwable results)
          (raise results)
          (respond (as-format-response export-format name results))))
      (catch Throwable e
        (raise e))
      (finally
        (a/close! in-chan))))
  nil)

(defn- add-row-constraint
  [query export-format]
  (if (= export-format "csv")
    (assoc-in query [:constraints] {:max-results (public-settings/unsaved-question-max-results)})
    (assoc-in query [:constraints] {:max-results 0})))

(def export-format-regex
  "Regex for matching valid export formats (e.g., `json`) for queries.
   Inteneded for use in an endpoint definition:

     (api/defendpoint POST [\"/:export-format\", :export-format export-format-regex]"
  (re-pattern (str "(" (str/join "|" (keys ex/export-formats)) ")")))

(api/defendpoint-async POST ["/:export-format", :export-format export-format-regex]
;   "Execute a query and download the result data as a file in the specified format."
  [{{:keys [export-format query name]} :params} respond raise]
  {query         su/JSONString
   export-format ExportFormat
   name su/NonBlankString}
  (let [{:keys [database] :as query} (json/parse-string query keyword)]
    (api/check-supported-export-format export-format)
    (when-not (= database database/virtual-id)
      (api/read-check Database database))
    (as-format-async export-format name respond raise
                     (qp.async/process-query-and-save-execution!
                      (-> query
                          (dissoc :constraints)
                          (add-row-constraint export-format)
                          (assoc-in [:middleware :skip-results-metadata?] true))
                      {:executed-by api/*current-user-id*, :context (export-format->context export-format)}))))


;;; ------------------------------------------------ Other Endpoints -------------------------------------------------

;; TODO - this is no longer used. Should we remove it?
(api/defendpoint POST "/duration"
  "Get historical query execution duration."
  [:as {{:keys [database], :as query} :body}]
  (api/read-check Database database)
  ;; try calculating the average for the query as it was given to us, otherwise with the default constraints if
  ;; there's no data there. If we still can't find relevant info, just default to 0
  {:average (or
             (some (comp query/average-execution-time-ms qputil/query-hash)
                   [query
                    (assoc query :constraints constraints/default-query-constraints)])
             0)})


;;; ------------------------------------------------ Streaming query result  -------------------------------------------------

(defn- as-format-response-stream
  "Return a response containing the `results` of a query in the specified format."
  {:style/indent 1, :arglists '([export-format results])}
  [name export-format {{:keys [columns rows cols]} :data, :keys [status], :as response}]
  (api/let-404 [export-conf (ex/export-formats export-format)]
               (if (not (nil? response))
      ;; successful query, send file
                 {:status  200
                  :body    response
                  :headers {"Content-Type"        (str (:content-type export-conf) "; charset=utf-8")
                            "Content-Disposition" (str "attachment; filename=\"" name "." (:ext export-conf) "\"")}}
      ;; failed query, send error message
                 {:status 500
                  :body   (:error "Somthing went wrong!")})))

(s/defn as-format-async-file
  "Write the results of an async query to API `respond` or `raise` functions in `export-format`. `in-chan` should be a
  core.async channel that can be used to fetch the results of the query."
  {:style/indent 3}
  [name export-format :- ExportFormat, respond :- (s/pred fn?), raise :- (s/pred fn?), in-chan :- ManyToManyChannel]
  (a/go
    (try
      (let [results (a/<! in-chan)]
        (if (instance? Throwable results)
          (raise results)
          (respond (as-format-response-stream name export-format results))))
      (catch Throwable e
        (raise e))
      (finally
        (a/close! in-chan))))
  nil)

;; ----------------- stream data set --------------------------------------------

(api/defendpoint-async POST ["/:export-format", :export-format export-format-regex]
  "Execute a query and download the result data as a file in the specified format."
  [{{:keys [export-format query name]} :params} respond raise]
  {query         su/JSONString
   export-format ExportFormat
   name su/NonBlankString}
  (let [{:keys [database] :as query} (json/parse-string query keyword)]
    (when-not (= database database/virtual-id)
      (api/read-check Database database))
    (as-format-async-file (append-db-name-if-needed-given-database-id name database) export-format respond raise
                           (qp.async/process-query-and-stream-file!
                            (-> query
                                (dissoc :constraints)
                                (assoc :enable-excel-conditional-formatting false
                                       :csv-buffer-size (setting/get :csv-buffer-size))
                                (m/dissoc-in [:middleware :add-default-userland-constraints?])
                                (assoc-in [:middleware :skip-results-metadata?] true)
                                (assoc-in [:middleware :export-fn] (:export-fn (ex/export-formats export-format))))
                            {:executed-by api/*current-user-id*, :context (export-format->context export-format)}))))

(api/define-routes)
