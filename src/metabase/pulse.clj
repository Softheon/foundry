(ns metabase.pulse
  "Public API for sending Pulses."
  (:require [clojure.tools.logging :as log]
            [metabase
             [email :as email]
             [query-processor :as qp]
             [util :as u]
             [public-settings :as public-settings]]
            [metabase.util.date :as du]
            [metabase.driver.util :as driver.u]
            [metabase.email.messages :as messages]
            [metabase.integrations.slack :as slack]
            [metabase.models
             [card :refer [Card]]
             [pulse :refer [Pulse]]
             [setting :as setting]]
            [metabase.pulse.render :as render]
            [metabase.util
             [i18n :refer [trs tru]]
             [ui-logic :as ui]
             [urls :as urls]
             [export :as export]]
            [schema.core :as s]
            [metabase.toucan.db :as db]
            [metabase.models.pulse-card-file :as pulse-card-file :refer [PulseCardFile]])
  (:import java.util.TimeZone
           java.util.UUID
           (java.io File)
           metabase.models.card.CardInstance))

;;; ------------------------------------------------- PULSE SENDING --------------------------------------------------


;; TODO: this is probably something that could live somewhere else and just be reused
(defn execute-card
  "Execute the query for a single Card. `options` are passed along to the Query Processor."
  [card-or-id & {:as options}]
  (let [card-id (u/get-id card-or-id)]
    (try
      (when-let [card (Card :id card-id, :archived false)]
        (let [{:keys [creator_id dataset_query]} card
              query                              (assoc dataset_query :async? false)]
          {:card   card
           :result (qp/process-query-and-save-with-max-results-constraints! query
                                                                            (merge {:executed-by creator_id
                                                                                    :context     :pulse
                                                                                    :card-id     card-id}
                                                                                   options))}))
      (catch Throwable e
        (log/warn e (trs "Error running query for Card {0}" card-id))))))

(defn- database-id [card]
  (or (:database_id card)
      (get-in card [:dataset_query :database])))

(s/defn defaulted-timezone :- TimeZone
  "Returns the timezone for the given `CARD`. Either the report
  timezone (if applicable) or the JVM timezone."
  [card :- CardInstance]
  (let [^String timezone-str (or (some-> card database-id driver.u/database->driver driver.u/report-timezone-if-supported)
                                 (System/getProperty "user.timezone"))]
    (TimeZone/getTimeZone timezone-str)))

(defn- first-question-name [pulse]
  (-> pulse :cards first :name))

(def ^:private alert-notification-condition-text
  {:meets "reached its goal"
   :below "gone below its goal"
   :rows  "results"})

(defn create-slack-attachment-data
  "Returns a seq of slack attachment data structures, used in `create-and-upload-slack-attachments!`"
  [card-results]
  (let [{channel-id :id} (slack/files-channel)]
    (for [{{card-id :id, card-name :name, :as card} :card, result :result} card-results]
      {:title                  card-name
       :attachment-bytes-thunk (fn [] (render/render-pulse-card-to-png (defaulted-timezone card) card result))
       :title_link             (urls/card-url card-id)
       :attachment-name        "image.png"
       :channel-id             channel-id
       :fallback               card-name})))

(defn create-and-upload-slack-attachments!
  "Create an attachment in Slack for a given Card by rendering its result into an image and uploading it."
  [attachments]
  (doall
   (for [{:keys [attachment-bytes-thunk attachment-name channel-id] :as attachment-data} attachments]
     (let [slack-file-url (slack/upload-file! (attachment-bytes-thunk) attachment-name channel-id)]
       (-> attachment-data
           (select-keys [:title :title_link :fallback])
           (assoc :image_url slack-file-url))))))

(defn- is-card-empty?
  "Check if the card is empty"
  [card]
  (let [result (:result card)]
    (or (zero? (-> result :row_count))
        ;; Many aggregations result in [[nil]] if there are no rows to aggregate after filters
        (= [[nil]]
           (-> result :data :rows)))))

(defn- are-all-cards-empty?
  "Do none of the cards have any results?"
  [results]
  (every? is-card-empty? results))

(defn- goal-met? [{:keys [alert_above_goal] :as pulse} results]
  (let [first-result         (first results)
        goal-comparison      (if alert_above_goal <= >=)
        goal-val             (ui/find-goal-value first-result)
        comparison-col-rowfn (ui/make-goal-comparison-rowfn (:card first-result)
                                                            (get-in first-result [:result :data]))]

    (when-not (and goal-val comparison-col-rowfn)
      (throw (Exception. (str (tru "Unable to compare results to goal for alert.")
                              " "
                              (tru "Question ID is ''{0}'' with visualization settings ''{1}''"
                                   (get-in results [:card :id])
                                   (pr-str (get-in results [:card :visualization_settings])))))))
    (some (fn [row]
            (goal-comparison goal-val (comparison-col-rowfn row)))
          (get-in first-result [:result :data :rows]))))

(defn- alert-or-pulse [pulse]
  (if (:alert_condition pulse)
    :alert
    :pulse))

(defmulti ^:private should-send-notification?
  "Returns true if given the pulse type and resultset a new notification (pulse or alert) should be sent"
  (fn [pulse _results] (alert-or-pulse pulse)))

(defmethod should-send-notification? :alert
  [{:keys [alert_condition] :as alert} results]
  (cond
    (= "rows" alert_condition)
    (not (are-all-cards-empty? results))

    (= "goal" alert_condition)
    (goal-met? alert results)

    :else
    (let [^String error-text (str (tru "Unrecognized alert with condition ''{0}''" alert_condition))]
      (throw (IllegalArgumentException. error-text)))))

(defmethod should-send-notification? :pulse
  [{:keys [alert_condition] :as pulse} results]
  (if (:skip_if_empty pulse)
    (not (are-all-cards-empty? results))
    true))

(defmulti ^:private create-notification
  "Polymorphoic function for creating notifications. This logic is different for pulse type (i.e. alert vs. pulse) and
  channel_type (i.e. email vs. slack)"
  (fn [pulse _ {:keys [channel_type] :as channel}]
    [(alert-or-pulse pulse) (keyword channel_type)]))

(defmethod create-notification [:pulse :email]
  [{:keys [id name] :as pulse} results {:keys [recipients] :as channel}]
  (log/debug (format "Sending Pulse (%d: %s) via Channel :email" id name))
  (let [email-subject    (str "Pulse: " name)
        email-recipients (filterv u/email? (map :email recipients))
        timezone         (-> results first :card defaulted-timezone)]
    {:subject      email-subject
     :recipients   email-recipients
     :message-type :attachments
     :message      (messages/render-pulse-email timezone pulse results)}))

(defmethod create-notification [:pulse :slack]
  [pulse results {{channel-id :channel} :details :as channel}]
  (log/debug (u/format-color 'cyan "Sending Pulse (%d: %s) via Slack" (:id pulse) (:name pulse)))
  {:channel-id  channel-id
   :message     (str "Pulse: " (:name pulse))
   :attachments (create-slack-attachment-data results)})

(defmethod create-notification [:alert :email]
  [{:keys [id] :as pulse} results {:keys [recipients] :as channel}]
  (log/debug (format "Sending Pulse (%d: %s) via Channel :email" id name))
  (let [condition-kwd    (messages/pulse->alert-condition-kwd pulse)
        email-subject    (format "Foundry alert: %s has %s"
                                 (first-question-name pulse)
                                 (get alert-notification-condition-text condition-kwd))
        email-recipients (filterv u/email? (map :email recipients))
        first-result     (first results)
        timezone         (-> first-result :card defaulted-timezone)]
    {:subject      email-subject
     :recipients   email-recipients
     :message-type :attachments
     :message      (messages/render-alert-email timezone pulse results (ui/find-goal-value first-result))}))

(defmethod create-notification [:alert :slack]
  [pulse results {{channel-id :channel} :details :as channel}]
  (log/debug (u/format-color 'cyan "Sending Alert (%d: %s) via Slack" (:id pulse) (:name pulse)))
  {:channel-id channel-id
   :message (str "Alert: " (first-question-name pulse))
   :attachments (create-slack-attachment-data results)})

(defmethod create-notification :default
  [_ _ {:keys [channel_type] :as channel}]
  (let [^String ex-msg (str (tru "Unrecognized channel type {0}" (pr-str channel_type)))]
    (throw (UnsupportedOperationException. ex-msg))))

(defmulti ^:private send-notification!
  "Invokes the side-affecty function for sending emails/slacks depending on the notification type"
  (fn [{:keys [channel-id] :as notification}]
    (if channel-id :slack :email)))

(defmethod send-notification! :slack
  [{:keys [channel-id message attachments]}]
  (let [attachments (create-and-upload-slack-attachments! attachments)]
    (slack/post-chat-message! channel-id message attachments)))

(defmethod send-notification! :email
  [{:keys [subject recipients message-type message]}]
  (email/send-message!
   :subject      subject
   :recipients   recipients
   :message-type message-type
   :message      message))

(defn- send-notifications! [notifications]
  (doseq [notification notifications]
    ;; do a try-catch around each notification so if one fails, we'll still send the other ones for example, an Alert
    ;; set up to send over both Slack & email: if Slack fails, we still want to send the email (#7409)
    (try
      (send-notification! notification)
      (catch Throwable e
        (log/error e (trs "Error sending notification!"))))))

(defn- pulse->notifications [{:keys [cards channel-ids], :as pulse}]
  (let [results     (for [card  cards
                          :let  [result (execute-card (:id card), :pulse-id (:id pulse))] ; Pulse ID may be `nil` if the Pulse isn't saved yet
                          :when result] ; some cards may return empty results, e.g. if the card has been archived
                      result)
        channel-ids (or channel-ids (mapv :id (:channels pulse)))]
    (when (should-send-notification? pulse results)

      (when (:alert_first_only pulse)
        (db/delete! Pulse :id (:id pulse)))

      (for [channel-id channel-ids
            :let       [channel (some #(when (= channel-id (:id %)) %) (:channels pulse))]]
        (create-notification pulse results channel)))))

(defn send-pulse!_old
  "Execute and Send a `Pulse`, optionally specifying the specific `PulseChannels`.  This includes running each
   `PulseCard`, formatting the results, and sending the results to any specified destination.

   Example:
       (send-pulse! pulse)                       Send to all Channels
       (send-pulse! pulse :channel-ids [312])    Send only to Channel with :id = 312"
  [{:keys [cards], :as pulse} & {:keys [channel-ids]}]
  {:pre [(map? pulse) (every? map? cards) (every? :id cards)]}
  (send-notifications! (pulse->notifications (merge pulse (when channel-ids {:channel-ids channel-ids})))))

(defn- report-default-parameters
  [card]
  (reduce (fn [result [_ value]]
            (assoc result (:display-name value) (:default value "")))
          {}
          (get-in (:dataset_query card) [:native :template-tags] {})))

(defn- get-excel-export-fn
  [card]
  (if (setting/get :enable-printable-pulse-excel)
    (let [report-name (:name card)]
      (export/export-to-printable-excel-file {:title report-name
                                              :author "SoftheonPulse"
                                              :sheet-name "Sheet1"
                                              :enable-column-auto-sizing (setting/get :enable-printable-pulse-excel-column-auto-sizing)
                                              :params (report-default-parameters card)}))
    export/export-to-excel-file))

(defn- report-name-to-display
  [name]
  (if (setting/get :enable-printable-pulse-excel)
    (str (.format (java.text.SimpleDateFormat. "yyyyMMdd") (java.util.Date.))
         " "
         name
         " by SoftheonPulse")
    name))

(defn execute-and-export-card
  [pulse-id pulse-card skip-if-empty]
  (let [card-id (:id pulse-card)
        site-url (public-settings/site-url)]
    (try
      (when-let [card (Card :id card-id, :archived false)]
        (let [{:keys [creator_id dataset_query]}  card
              export-fn (if (:include_xls pulse-card)
                          (get-excel-export-fn card)
                          export/export-to-csv-file)
              query (-> dataset_query
                        (assoc :async? false)
                        (assoc
                         :constraints nil
                         :middleware {:skip-results-metadata? true
                                      :export-fn (partial export-fn card-id skip-if-empty)}))
              options {:executed-by creator_id
                       :context :pulse
                       :card-id card-id}
              result (qp/process-query-and-stream-file! query options)]
          (if-not (instance? File result)
            (do
              (log/warn (str "Unable to export the report" {:cause result}))
              nil)

            (let [_ (db/insert! PulseCardFile {:id  (str (UUID/randomUUID))
                                               :pulse_id pulse-id
                                               :card_id card-id
                                               :location (.getAbsolutePath result)})
                  latest-file (db/select-one PulseCardFile
                                             :pulse_id pulse-id
                                             :card_id card-id
                                             {:order-by [[:created_at :desc]]})]

              (future
                (let [expired-date (du/->Timestamp
                                    (- (.getTime (:created_at latest-file))  (* 7 24 60 60000)))]

                  (db/delete! PulseCardFile
                              {:where [:and
                                       [:= :card_id card-id]
                                       [:= :pulse_id pulse-id]
                                       [:<= :created_at expired-date]]})))
              (-> latest-file
                  (assoc :name
                         (if (:include_xls pulse-card)
                           (report-name-to-display (:name card))
                           (:name card)))
                  (assoc :download
                         (str site-url "/question/" card-id "/download/"
                              (str (:pulse_id latest-file) "_" (:id latest-file)))))))))
      (catch Throwable e
        (log/error e (trs "Error exporting query for Card {0}" card-id))
        (throw e)))))

(defn- create-email-notification
  [{:keys [id name] :as pulse} results {:keys [recipients] :as channel}]
  (log/debug (format "Sending Pulse (%d: %s) via Channel :email" id name))
  (let [email-subject (str "Report: " name)
        email-recipients (filterv u/email? (map :email recipients))]
    {:subject email-subject
     :recipients email-recipients
     :message-type :html
     :message (messages/render-report-email pulse results)}))

(defn- pulse->email-notifications
  [{:keys [cards channel-ids] :as pulse}]
  (let [results (for [card cards
                      :let [result (execute-and-export-card  (:id pulse) card (:skip_if_empty pulse))]
                      :when result]
                  result)
        channel-ids (or channel-ids (mapv :id (:channels pulse)))]
    (when (> (count results) 0)
      (for [channel-id channel-ids
            :let [channel (some #(when (= channel-id (:id %)) %) (:channels pulse))]]
        (create-email-notification pulse results channel)))))

(defn send-pulse!
  [{:keys [cards] :as pulse} & {:keys [channel-ids]}]
  {:pre [(map? pulse) (every? map? cards) (every? :id cards)]}
  (send-notifications! (pulse->email-notifications (merge pulse (when channel-ids {:channel-ids channel-ids})))))
