(ns metabase.api.spreadsheet
  "/api/spreadsheet endpoints"
  (:require [clojure.string :as str]
            [clojure.tools.logging :as log]
            [compojure.core :refer [DELETE GET POST PUT]]
            [metabase.api
             [common :as api]]
            [metabase.util
             [i18n :refer [tru]]
             [schema :as su]]
            [schema.core :as s]
            [clojure.data.csv :as csv]
            [dk.ative.docjure.spreadsheet :as excel]
            [clojure.java
             [io :as io]
             [jdbc :as jdbc]]))


;;; ----------------------------------------------- POST /api/database ------------------------------------------------

(def SpreadsheetType
  (su/with-api-error-message (s/constrained 
                              su/NonBlankString
                              #(or (= % "csv")
                                   (= % "xlsx"))
                              "Valid Spreadsheet type"
                              )
                             (tru "value must be a valid spreadsheet type.")))

(defn- csv-data->maps
  [csv-data]
  (map zipmap
       (->> (first csv-data)
            (map #(keyword (str "[" % "]")))
            repeat)
       (rest csv-data)))

(defn table-ddl
  [table-name, headers]
  (jdbc/create-table-ddl (str "[" table-name "]")
                         (vec (map #(conj [(keyword (str "[" % "]"))] "varchar(278)") headers))))
(defn- import-spreadsheet
  [connection table-name rows]
  (let [headers (first rows)
        data (csv-data->maps rows)
        table-ddl (table-ddl table-name headers)]
    (jdbc/db-do-commands connection table-ddl)
    (jdbc/insert-multi! connection (keyword table-name) data)))

(defn- import-csv
  [connection file table-name]
  (with-open [reader (clojure.java.io/reader file)]
    (import-spreadsheet connection  table-name (csv/read-csv reader))))

(defn- import-xlsx
  [connection file table-name]
  (log/info "file name" (.getAbsolutePath file))
  (let [rows    (->> (excel/load-workbook (.getAbsolutePath file))
                     (excel/select-sheet #".")
                     excel/row-seq
                     (remove nil?)
                     (map excel/cell-seq)
                     (map #(map excel/read-cell %)))]
    (import-spreadsheet connection  table-name rows)))

(api/defendpoint POST "/"
  "Add a new `Spreadsheet`"
  [:as {{:keys [name file type user password db host port instance] :as params} :params
        :as request}]
  (api/check-superuser)
  (let [db-spec {:dbtype "sqlserver"
                 :dbname db
                 :user user
                 :password password
                 :port port
                 :host  host}
        tempfile (:tempfile file)]
    (jdbc/with-db-transaction [connection db-spec]
      (case type
        "csv" (import-csv connection tempfile name)
        "xlsx" (import-xlsx connection tempfile name)
        (throw (Exception.  "Unsupported file type"))))))

(api/define-routes)
