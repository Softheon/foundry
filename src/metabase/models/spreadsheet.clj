(ns metabase.models.spreadsheet
  (:require
   [cheshire.generate :refer [add-encoder encode-map]]
   [clojure.tools.logging :as log]
   [metabase.api.common :refer [*current-user*]]
   [metabase
    [db :as mdb]
    [util :as u]]
   [metabase.toucan
    [db :as db]
    [models :as models]]))


;;; ----------------------------------------------- Entity & Lifecycle -----------------------------------------------

(models/defmodel Spreadsheet :spreadsheet)

(u/strict-extend (class Spreadsheet)
                 models/IModel
                 (merge models/IModelDefaults
                        {:types (constantly {:details :encrypted-json
                                             :type :keyword})
                         :properties (constantly {:timestamped? true})}))

(add-encoder
 SpreadsheetInstance
 (fn [sheet json-generator]
   (encode-map (cond
                 (not (:is_superuser @*current-user*)) (dissoc sheet :details)
                 (get-in sheet [:details :password]) (assoc-in sheet [:details :password] "******")
                 :else sheet)
               json-generator)))