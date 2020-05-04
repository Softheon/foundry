(ns metabase.models.pulse-card-file
  (:require [clojure.tools.logging :as log]
            [clojure.java.io :as io]
            [metabase.util :as u]
            [metabase.util.date :as du]
            [metabase.toucan
             [db :as db]
             [models :as models]]))

;; ## Entity type
(models/defmodel PulseCardFile :pulse_card_file)

(defn- pre-insert
  [pulse-card-file]
  (assoc pulse-card-file :created_at (du/new-sql-timestamp)))

(defn- pre-delete
  [{:keys [location]}]
  (when location
    (let [file (io/file location)]
      (when (.exists file)
        (try  (.delete file)
              (catch Exception e
                (log/error (str "Unable to delete the file" location) e)))))))

(u/strict-extend (class PulseCardFile)
                 models/IModel
                 (merge models/IModelDefaults
                        {:pre-insert pre-insert}))

(defn latest-pulse-file
  "Retrieves the latest pulse file `:id` for a given pulse_id and card_id , or nil otherwise."
  ^String [pulse-id card_id]
  (db/select PulseCardFile
             :pulse_id pulse-id
             :card_id card_id
             {:order-by [[:created_at :desc]]}))
