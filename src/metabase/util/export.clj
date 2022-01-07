(ns metabase.util.export
  (:require [clojure.core.async :as a]
            [cheshire.core :as json]
            [metabase.csv.csv :as csv]
           ;; [dk.ative.docjure.spreadsheet :as spreadsheet]
            [clojure.java.io :as io]
            [ring.util.io :as ring-io]
            [clojure.tools.logging :as log]
            [metabase.util
             [xlsx :as excel]
             [i18n :refer [trs]]]
            [metabase.config :as config])
  (:import [java.io ByteArrayInputStream ByteArrayOutputStream File FileOutputStream]
           (java.io PipedInputStream PipedOutputStream)
           (java.util.concurrent Executors ThreadPoolExecutor)
           java.util.UUID
           org.apache.commons.lang3.concurrent.BasicThreadFactory$Builder
           org.apache.poi.ss.usermodel.Cell))

;; add a generic implementation for the method that writes values to XLSX cells that just piggybacks off the
;; implementations we've already defined for encoding things as JSON. These implementations live in
;; `metabase.middleware`.
;; (defmethod spreadsheet/set-cell! Object [^Cell cell, value]
;;   (when (= (.getCellType cell) Cell/CELL_TYPE_FORMULA)
;;     (.setCellType cell Cell/CELL_TYPE_STRING))
;;   ;; stick the object in a JSON map and encode it, which will force conversion to a string. Then unparse that JSON and
;;   ;; use the resulting value as the cell's new String value.  There might be some more efficient way of doing this but
;;   ;; I'm not sure what it is.
;;   (.setCellValue cell (str (-> (json/generate-string {:v value})
;;                                (json/parse-string keyword)
;;                                :v))))

(defmethod excel/set-cell! Object [^Cell cell, value]
  (.setCellValue cell (str (-> (json/generate-string {:v value})
                               (json/parse-string keyword)
                               :v))))

(defn- results->cells
  "Convert the resultset to a seq of rows with the first row as a header"
  [results]
  (cons (map :display_name (get-in results [:result :data :cols]))
        (get-in results [:result :data :rows])))

(defn- close-quietly
  [object]
  (when (some? object)
    (try
      (.close object)
      (catch Throwable e
        (log/error e)))))

;; (defn- export-to-xlsx [columns rows]
;;   (let [wb  (spreadsheet/create-workbook "Query result" (cons (mapv name columns) rows))
;;         ;; note: byte array streams don't need to be closed
;;         out (ByteArrayOutputStream.)]
;;     (spreadsheet/save-workbook! out wb)
;;     (ByteArrayInputStream. (.toByteArray out))))

(defn export-to-xlsx-file
  "Write an XLS file to `FILE` with the header a and rows found in `RESULTS`"
  [^File file results]
  ;; (let [file-path (.getAbsolutePath file)]
  ;;   (->> (results->cells results)
  ;;        (spreadsheet/create-workbook "Query result")
  ;;        (spreadsheet/save-workbook! file-path)))
  )

(defn- export-to-csv [columns rows]
  (with-out-str
    ;; turn keywords into strings, otherwise we get colons in our output
    (csv/write-csv *out* (into [(mapv name columns)] rows))))

(defn export-to-csv-writer
  "Write a CSV to `FILE` with the header a and rows found in `RESULTS`"
  [^File file results]

  (with-open [fw (java.io.FileWriter. file)]
    (csv/write-csv fw (results->cells results))))

(defn- export-to-json [columns rows]
  (for [row rows]
    (zipmap columns row)))

; (defn stream-csv-format
;   [result]
;   (let [csv-stream-writer (fn [writer]
;                       (csv/write-csv writer result)
;                       (.flush writer))]
;     (ring-io/piped-input-stream #(csv-stream-writer (io/make-writer % {})))))

(defn csv-stream-writer
  [writer results]
  (let [out (io/make-writer writer {})]
    (try
      (csv/write-csv out results)
      (.flush out)
      (catch Exception e
        (throw e))
      (finally
        (.close out)))))

(def  ^:private ^Long thread-pool-max-size
  (or (config/config-int :mb-async-query-thread-pool-size)
      (config/config-int :mb-jetty-maxthreads)
      50))

(defonce ^:private thread-pool*
  (delay
   (Executors/newFixedThreadPool thread-pool-max-size
                                 (.build
                                  (doto (BasicThreadFactory$Builder.)
                                    (.namingPattern "download-streaming-response-thread-pool-%d")
                                    (.daemon true))))))

(defn thread-pool
  "Thread pool for asynchronously running streaming response."
  ^ThreadPoolExecutor []
  @thread-pool*)

(defn- create-export-file
  [card-id, suffix]
  (let [file-name (format "foundry_report_%d_%s" card-id (str (UUID/randomUUID)))]
    (if (config/config-str :export-directory)
      (let [export-directory (config/config-str :export-directory)
            dir (io/file export-directory)]
        ;; create directory if does not exist
        (when-not (.exists dir)
          (.mkdir dir))
        ;; if dir exists, create a file in the dir; otherwise, fallback to using template file
        (if (.exists dir)
          (io/file (str dir "\\" file-name suffix))
          (doto (File/createTempFile "foundry-temp-file" suffix)
            .deleteOnExit)))
      (doto (File/createTempFile "foundry-temp-file" suffix)
        .deleteOnExit))))

(defn export-to-csv-file
  [card-id  skip-if-empty connection]
  (fn [stmt rset data]
    (when (and (true? skip-if-empty) (<= (count data) 1))
      (log/info "skip empty card" card-id)
      (close-quietly rset)
      (close-quietly stmt)
      (close-quietly (:connection connection))
      (throw (ex-info (str "skip empty result") {:card-id card-id})))
    (let [finished-chan (a/promise-chan)
          file (create-export-file card-id ".csv")
          conn (:connection connection)
          task (bound-fn []
                 (try
                   (with-open [writer (io/writer file)]
                     (csv/write-csv writer data))
                   (a/>!! finished-chan file)
                   (catch Throwable e
                     (a/>!! finished-chan e))
                   (finally
                     (try
                       (a/close! finished-chan)
                       (close-quietly rset)
                       (close-quietly stmt)
                       (.rollback conn)
                       (catch Throwable e
                         (throw (ex-info (str "export-to-csv-file: failed to export to csv because Rollback failed handling \""
                                              (.getMessage e)
                                              "\"")
                                         {:rollback e})))
                       (finally
                         (close-quietly rset)
                         (close-quietly stmt)
                         (close-quietly conn)
                         (log/info "all db resources assoicated with exporting a csv file are closed."))))))]
      (log/info "exporting report file", (.getAbsolutePath file))
      (.submit (thread-pool) ^Runnable task)
      (a/<!! finished-chan))))

(defn export-to-csv-stream
  [connection]
  (fn [stmt rset data]
    (let [input (PipedInputStream.)
          output (PipedOutputStream.)
          conn (:connection connection)
          task (bound-fn []
                 (try
                   (let [out (io/make-writer output {})]
                     (try
                       (csv/write-csv out data)
                       (finally
                         (.flush out))))
                   (finally
                     (try
                       (.flush output)
                       (.close output)
                       (.rollback conn)
                       (catch Throwable e
                         (log/info "failed to close reousrces properly")
                         (log/info e)
                         (throw (ex-info (str "export-to-csv-stream: failed to export csv because rollback failed handling \""
                                              (.getMessage e)
                                              "\"")
                                         {:rollback e})))
                       (finally
                         (close-quietly rset)
                         (close-quietly stmt)
                         (close-quietly conn)
                         (log/info "all db resources for streaming a csv file are closed")
                         )))))]
      (.connect input output)
      (.submit (thread-pool) ^Runnable task)
      input)))


(defn export-to-excel-file
  [card-id skip-if-empty connection]
  (fn [stmt rset data]
    (when (and (true? skip-if-empty) (<= (count data) 1))
      (log/info "skip empty card" card-id)
      (close-quietly rset)
      (close-quietly stmt)
      (close-quietly (:connection connection))
      (throw (ex-info (str "skip empty result") {:card-id card-id})))
    (let [finished-chan (a/promise-chan)
          file (create-export-file card-id ".xlsx")
          conn (:connection connection)
          task (bound-fn []
                 (try
                   (let [workbook (excel/create-workbook "Report Result" data)]
                     (with-open [output-stream (FileOutputStream. file)]
                       (try
                         (excel/save-workbook! output-stream workbook)
                         (finally
                           (excel/dispose-workbook workbook)))))
                   (a/>!! finished-chan file)
                   (catch Throwable e
                     (a/>!! finished-chan e))
                   (finally
                     (try
                       (a/close! finished-chan)
                       (.rollback conn)
                       (catch Throwable e
                         (log/info "excel: failed to close reousrces properly")
                         (log/info e)
                         (throw (ex-info (str "failed to export to excel because Rollback failed handling \""
                                              (.getMessage e)
                                              "\"")
                                         {:rollback e})))
                       (finally
                         (close-quietly rset)
                         (close-quietly stmt)
                         (close-quietly conn)
                         (log/info "all db resources associated with exporting an excel report are released."))))))]
      (log/info "exporting report file", (.getAbsolutePath file))
      (.submit (thread-pool) ^Runnable task)
      (a/<!! finished-chan))))

(defn export-to-printable-excel-file
  [setting]
  (fn [card-id skip-if-empty connection]
    (fn [stmt rset data]
      (if (and  (true? skip-if-empty) (<= (count data) 1))
        (do
          (log/info "skipping generating printable excel file because the result is empty for the card id " card-id)
          (close-quietly rset)
          (close-quietly stmt)
          (close-quietly (:connection connection)))
        (let [finished-chan (a/promise-chan)
              file (create-export-file card-id ".xlsx")
              conn (:connection connection)
              task (bound-fn []
                     (try
                       (let [workbook (excel/printable-workbook (assoc setting :data data))]
                         (with-open [output-stream (FileOutputStream. file)]
                           (try
                             (excel/save-workbook! output-stream workbook)
                             (finally
                               (excel/dispose-workbook workbook)))))
                       (a/>!! finished-chan file)
                       (catch Throwable e
                         (log/error "failed to generate printable excel file " e)
                         (a/>!! finished-chan e))
                       (finally
                         (try
                           (a/close! finished-chan)
                           (.rollback conn)
                           (catch Throwable e
                             (log/error "failed to rollback database connection" e))
                           (finally
                             (close-quietly rset)
                             (close-quietly stmt)
                             (close-quietly conn)
                             (log/info "all db resources associated with exporting printable excel are closed."))))))]
          (.submit (thread-pool) ^Runnable task)
          (a/<!! finished-chan))))))

(defn export-to-xlsx-stream
  [connection]
  (fn [stmt rset data]
    (let [input (PipedInputStream.)
          output (PipedOutputStream.)
          transfering-chan (a/promise-chan)
          conn (:connection connection)
          task (bound-fn []
                 (try
                   (let [workbook (excel/create-workbook "Report Result" data)]
                     (try
                       (a/>!! transfering-chan :start)
                       (excel/save-workbook! output workbook)
                       (finally
                         (a/close! transfering-chan)
                         (excel/dispose-workbook workbook))))
                   (catch Throwable e
                     (log/error e (trs "unexpected Exception during steaming excel response.")))
                   (finally
                     (try
                       (.flush output)
                       (.close output)
                       (.rollback conn)
                       (catch Throwable e
                         (throw (ex-info (str "failed to export to excel because Rollback failed handling \""
                                              (.getMessage e)
                                              "\"")
                                         {:rollback e})))
                       (finally
                         (close-quietly rset)
                         (close-quietly stmt)
                         (close-quietly conn)
                         (log/info "all db resource associated with streaming excel file are closed."))))))]
      (.connect input output)
      (.submit (thread-pool) ^Runnable task)
      (a/<!! transfering-chan)
      input)))

(defn export-printable-xlsx-stream
  [settings]
  (fn [connection]
    (fn [stmt rset data]
      (let [input (PipedInputStream.)
            output (PipedOutputStream.)
            transfering-chan (a/promise-chan)
            conn (:connection connection)
            task (bound-fn []
                   (try
                     (let [workbook (excel/printable-workbook (assoc settings :data data))]
                       (try
                         (a/>!! transfering-chan :start)
                         (excel/save-workbook! output workbook)
                         (finally
                           (excel/dispose-workbook workbook)
                           (a/close! transfering-chan)
                           (.flush output)
                           (.rollback conn))))
                     (catch Throwable e
                       (log/error e (trs "Unable to stream printable excel")))
                     (finally
                       (close-quietly output)
                       (close-quietly rset)
                       (close-quietly stmt)
                       (close-quietly conn)
                       (log/info "all db resources associated with streaming printable excel are closed."))))]
        (.connect input output)
        (.submit (thread-pool) ^Runnable task)
        (a/<!! transfering-chan)
        input))))

(def export-formats
  "Map of export types to their relevant metadata"
  {"csv"  {:export-fn    export-to-csv-stream
           :content-type "text/csv"
           :ext          "csv"
           :context      :csv-download}
   "xlsx" {:export-fn    export-to-xlsx-stream
           :content-type "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
           :ext          "xlsx"
           :context      :xlsx-download}
   "printable-xlsx" {:export-fn export-printable-xlsx-stream
                     :content-type "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                     :ext          "xlsx"
                     :context      :xlsx-download}
  ;  "json" {:export-fn    export-to-json
  ;          :content-type "applicaton/json"
  ;          :ext          "json"
  ;          :context      :json-download}
   })

(defn- export-card-to-json
  [card]
  (assoc {}
         :id (:id card)
         :collection_id (:collection_id card)
         :visualization_settings (:visualization_settings card)
         :dataset_query (:dataset_query card)
         :description (:description card)
         :database_id (:database_id card)
         :display (:display card)
         :name (:name card)
         :collection_position (:collection_position card)))

(def card-export-formats
  "Map of card export types to their relevant metadata"
  {"json" {:export-fn export-card-to-json
           :content-type "application/json"
           :ext "json"
           :context ":json-download"}})
