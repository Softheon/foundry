(ns metabase.task.delete-unsaved-reports
  "Tasks related to delete unsaved reprots"
  (:require
   [clojure.tools.logging :as log]
   [clojurewerkz.quartzite
    [jobs :as jobs]
    [triggers :as triggers]]
   [clojurewerkz.quartzite.schedule.cron :as cron]
   [metabase
    [task :as task]]
   [metabase.models
    [card :refer [Card]]
    [collection :refer [Collection]]
    [task-history :as task-history]]
   [honeysql.core :as hsql]
   [metabase.toucan
    [db :as db]]
   [metabase.util.i18n :refer [trs]]))

(jobs/defjob DeleteUnsavedReports [_]
  (try
    (task-history/with-task-history {:task "delete-unsaved-reports"}
      (let [ids (map :id
                     (db/query
                      {:select [:card.id]
                       :from [[Card :card]]
                       :join [[Collection :coll] [:= :card.collection_id :coll.id]]
                       :where [:and
                               [:<> :coll.personal_owner_id nil]
                               [:like :card.name "Unsaved%"]
                               [:> (hsql/raw "DATEDIFF(D,  card.updated_at, CURRENT_TIMESTAMP)") 30]]
                       :order-by [[:card.id :asc]]}))]
        (log/debug (format "Starting deleting unsaved reports: %s" ids))
        (when-not (empty? ids)
          (db/delete! 'Card
                      :id [:in ids]))
        (log/debug (format "Finished deleting unsaved reports: %s" ids))))
    (catch Throwable e
      (log/error e (trs "DeleteUnsavedReprots failed")))))

(def ^:private delete-unsaved-reports-job-key "metabase.task.delete-unsaved-reports.job")
(def ^:private delete-unsaved-reports-trigger-key "metabase.task.delete-unsaved-reports.trigger")

(defmethod task/init! ::DeleteUnsavedReports [_]
  (let [job (jobs/build
             (jobs/of-type DeleteUnsavedReports)
             (jobs/with-identity (jobs/key delete-unsaved-reports-job-key)))
        trigger (triggers/build
                 (triggers/with-identity (triggers/key delete-unsaved-reports-trigger-key))
                 (triggers/start-now)
                 (triggers/with-schedule
                   (cron/schedule
                   ;; run hourly
                    (cron/cron-schedule "0 0 * * * ? *")
                    (cron/with-misfire-handling-instruction-ignore-misfires))))]
    (task/schedule-task! job trigger)))
