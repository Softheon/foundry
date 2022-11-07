(ns metabase.api.spreadsheet
  "/api/spreadsheet endpoints"
  (:require [clojure.string :as str]
            [clojure.tools.logging :as log]
            [compojure.core :refer [DELETE GET POST]]
            [honeysql.helpers :as hh]
            [metabase.api
             [common :as api]]
            [metabase.models
             [spreadsheet :refer [Spreadsheet]]]
            [metabase.util
             [i18n :refer [tru]]
             [schema :as su]]
            [metabase.toucan
             [db :as db]]
            [schema.core :as s]
            [clojure.data.csv :as csv]
            [dk.ative.docjure.spreadsheet :as excel]
            [clojure.java
             [io :as io]
             [jdbc :as jdbc]]))


;;; ----------------------------------------------- DELETE /api/spreadsheet/:id  ------------------------------------------------
(api/defendpoint DELETE "/:id"
  "Delete a spreadsheet"
  [id]
  (api/check-superuser)
  (let [spreadsheet (Spreadsheet id)
        db-spec (:details spreadsheet)
        name (:name spreadsheet)
        drop-table-ddl (jdbc/drop-table-ddl (keyword (str "[" name "]")))]
    (jdbc/db-do-commands db-spec drop-table-ddl)
    (db/delete! Spreadsheet :id id)))

;;; ----------------------------------------------- GET /api/spreadsheet ------------------------------------------------

(api/defendpoint GET "/"
  "Fetch a list of spreadsheets"
  []
  (api/check-superuser)
  (db/select Spreadsheet
             (-> {}
                 (hh/merge-order-by [:created_at :desc])
                 (hh/merge-where [:= :is_completed true]))))


;;; ----------------------------------------------- POST /api/spreadsheet ------------------------------------------------

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
    (let [rows (csv/read-csv reader)
          headers (first rows)
          data (rest rows)
          table-ddl (table-ddl table-name headers)]
      (jdbc/db-do-commands connection table-ddl)
      (jdbc/insert-multi! connection (keyword table-name) headers data {:multi? true}))))

(defn- import-xlsx
  [connection file table-name]
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
        (throw (Exception.  "Unsupported file type")))
      (db/insert! Spreadsheet  {:name name
                                :type (keyword type)
                                :is_completed true
                                :details db-spec}))))

(api/define-routes)
