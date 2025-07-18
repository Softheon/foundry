(ns metabase.api.pulse
  "/api/pulse endpoints."
  (:require [clojure.tools.logging :as log]
            [compojure.core :refer [DELETE GET POST PUT]]
            [hiccup.core :refer [html]]
            [metabase
             [email :as email]
             [events :as events]
             [pulse :as p]
             [query-processor :as qp]
             [util :as u]]
            [metabase.api.common :as api]
            [metabase.integrations.slack :as slack]
            [metabase.models
             [card :refer [Card]]
             [collection :as collection]
             [interface :as mi]
             [pulse :as pulse :refer [Pulse]]
             [pulse-card-file :refer [PulseCardFile]]
             [pulse-channel :refer [channel-types PulseChannel]]]
            [metabase.pulse.render :as render]
            [metabase.util
             [i18n :refer [tru]]
             [schema :as su]
             [urls :as urls]]
            [schema.core :as s]
            [metabase.toucan
             [db :as db]
             [hydrate :refer [hydrate]]])
  (:import java.io.ByteArrayInputStream))

(api/defendpoint GET "/"
  "Fetch all Pulses"
  [archived]
  {archived (s/maybe su/BooleanString)}
  (api/check-pulse-permission)
  (as-> (pulse/retrieve-pulses {:archived? (Boolean/parseBoolean archived)}) <>
    (filter mi/can-read? <>)
    (hydrate <> :can_write)))

(defn check-card-read-permissions
  "Users can only create a pulse for `cards` they have access to."
  [cards]
  (doseq [card cards
          :let [card-id (u/get-id card)]]
    (assert (integer? card-id))
    (api/read-check Card card-id)))

(api/defendpoint POST "/"
  "Create a new `Pulse`."
  [:as {{:keys [name cards channels skip_if_empty collection_id collection_position]} :body}]
  {name                su/NonBlankString
   cards               (su/non-empty [pulse/CoercibleToCardRef])
   channels            (su/non-empty [su/Map])
   skip_if_empty       (s/maybe s/Bool)
   collection_id       (s/maybe su/IntGreaterThanZero)
   collection_position (s/maybe su/IntGreaterThanZero)}
  (api/check-pulse-permission)
  ;; make sure we are allowed to *read* all the Cards we want to put in this Pulse
  (check-card-read-permissions cards)
  ;; if we're trying to create this Pulse inside a Collection, make sure we have write permissions for that collection
  (collection/check-write-perms-for-collection collection_id)
  (let [pulse-data {:name                name
                    :creator_id          api/*current-user-id*
                    :skip_if_empty       skip_if_empty
                    :collection_id       collection_id
                    :collection_position collection_position}]
    (db/transaction
      ;; Adding a new pulse at `collection_position` could cause other pulses in this collection to change position,
      ;; check that and fix it if needed
     (api/maybe-reconcile-collection-position! pulse-data)
      ;; ok, now create the Pulse
     (api/check-500
      (pulse/create-pulse! (map pulse/card->ref cards) channels pulse-data)))))


(api/defendpoint GET "/:id"
  "Fetch `Pulse` with ID."
  [id]
  (api/check-pulse-permission)
  (-> (api/read-check (pulse/retrieve-pulse id))
      (hydrate :can_write)))

(api/defendpoint PUT "/:id"
  "Update a Pulse with `id`."
  [id :as {{:keys [name cards channels skip_if_empty collection_id archived], :as pulse-updates} :body}]
  {name          (s/maybe su/NonBlankString)
   cards         (s/maybe (su/non-empty [pulse/CoercibleToCardRef]))
   channels      (s/maybe (su/non-empty [su/Map]))
   skip_if_empty (s/maybe s/Bool)
   collection_id (s/maybe su/IntGreaterThanZero)
   archived      (s/maybe s/Bool)}
  (api/check-pulse-permission)
  ;; do various perms checks
  (let [pulse-before-update (api/write-check Pulse id)]
    (check-card-read-permissions cards)
    (collection/check-allowed-to-change-collection pulse-before-update pulse-updates)

    (db/transaction
      ;; If the collection or position changed with this update, we might need to fixup the old and/or new collection,
      ;; depending on what changed.
     (api/maybe-reconcile-collection-position! pulse-before-update pulse-updates)
      ;; ok, now update the Pulse
     (pulse/update-pulse!
      (assoc (select-keys pulse-updates [:name :cards :channels :skip_if_empty :collection_id :collection_position
                                         :archived])
             :id id))))
  ;; return updated Pulse
  (pulse/retrieve-pulse id))


(api/defendpoint DELETE "/:id"
  "Delete a Pulse. (DEPRECATED -- don't delete a Pulse anymore -- archive it instead.)"
  [id]
  (api/check-pulse-permission)
  (log/warn (tru "DELETE /api/pulse/:id is deprecated. Instead, change its `archived` value via PUT /api/pulse/:id."))
  (api/let-404 [pulse (Pulse id)]
               (api/write-check Pulse id)
               (db/delete! Pulse :id id)
               (events/publish-event! :pulse-delete (assoc pulse :actor_id api/*current-user-id*)))
  api/generic-204-no-content)


(api/defendpoint GET "/form_input"
  "Provides relevant configuration information and user choices for creating/updating Pulses."
  []
  (api/check-pulse-permission)
  (let [chan-types (-> channel-types
                       ;(assoc-in [:slack :configured] (slack/slack-configured?))
                       (assoc-in [:email :configured] (email/email-configured?)))]
    {:channels (if-not (get-in chan-types [:slack :configured])
                 ;; no Slack integration, so we are g2g
                 chan-types
                 ;; if we have Slack enabled build a dynamic list of channels/users
                 (try
                   (let [slack-channels (for [channel (slack/channels-list)]
                                          (str \# (:name channel)))
                         slack-users    (for [user (slack/users-list)]
                                          (str \@ (:name user)))]
                     (assoc-in chan-types [:slack :fields 0 :options] (concat slack-channels slack-users)))
                   (catch Throwable e
                     (assoc-in chan-types [:slack :error] (.getMessage e)))))}))

(defn- pulse-card-query-results [card]
  (qp/process-query-and-save-execution! (:dataset_query card) {:executed-by api/*current-user-id*
                                                               :context     :pulse
                                                               :card-id     (u/get-id card)}))
(defn- pulse-card-query-results
  {:arglists '([card])}
  [{query :dataset_query, card-id :id}]
  (qp/process-query-and-save-execution! (assoc query :async? false)
                                        {:executed-by  api/*current-user-id*
                                         :context :pulse
                                         :card-id card-id}))

(api/defendpoint GET "/preview_card/:id"
  "Get HTML rendering of a Card with `id`."
  [id]
  (api/check-pulse-permission)
  (let [card   (api/read-check Card id)
        result (pulse-card-query-results card)]
    {:status 200
     :body   (html
              [:html
               [:body {:style "margin: 0;"}
                (binding [render/*include-title*   true
                          render/*include-buttons* true]
                  (render/render-pulse-card-for-display (p/defaulted-timezone card) card result))]])}))

(api/defendpoint GET "/preview_card_info/:id"
  "Get JSON object containing HTML rendering of a Card with `id` and other information."
  [id]
  (api/check-pulse-permission)
  (let [card      (api/read-check Card id)
        result    nil ;(pulse-card-query-results card)
        data      nil ;(:data result)
        card-type nil ;(render/detect-pulse-card-type card data)
        card-html nil ;(html (binding [render/*include-title* true]
                         ; (render/render-pulse-card-for-display (p/defaulted-timezone card) card result)))
        ]
    {:id              id
     :pulse_card_type card-type
     :pulse_card_html card-html
     :pulse_card_name (:name card)
     :pulse_card_url  (urls/card-url (:id card))
     :row_count       0 ;(:row_count result)
     :col_count      0; (count (:cols (:data result)))
     }))

(api/defendpoint GET "/preview_card_png/:id"
  "Get PNG rendering of a Card with `id`."
  [id]
  (api/check-pulse-permission)
  (let [card   (api/read-check Card id)
        result (pulse-card-query-results card)
        ba     (binding [render/*include-title* true]
                 (render/render-pulse-card-to-png (p/defaulted-timezone card) card result))]
    {:status 200, :headers {"Content-Type" "image/png"}, :body (ByteArrayInputStream. ba)}))

(api/defendpoint POST "/test"
  "Test send an unsaved pulse."
  [:as {{:keys [name cards channels skip_if_empty collection_id collection_position] :as body} :body}]
  {name                su/NonBlankString
   cards               (su/non-empty [pulse/CoercibleToCardRef])
   channels            (su/non-empty [su/Map])
   skip_if_empty       (s/maybe s/Bool)
   collection_id       (s/maybe su/IntGreaterThanZero)
   collection_position (s/maybe su/IntGreaterThanZero)}
  (api/check-pulse-permission)
  (check-card-read-permissions cards)
  (p/send-pulse! body)
  {:ok true})

(defn- safe-parse-int
  "Safely parse a value to integer, returning default if parsing fails"
  [val default]
  (try
    (cond
      (integer? val) val
      (string? val) (Integer/parseInt val)
      (keyword? val) (Integer/parseInt (name val))
      :else default)
    (catch Exception e
      (log/warn "Failed to parse integer:" val e)
      default)))

(defn- matches-pulse-schedule?
  "Check if execution time matches pulse schedule.
   Focuses on date, hour, and minute - ignoring seconds and milliseconds."
  [execution-time channel]
  (when execution-time
    (try
      (let [exec-time (if (instance? java.sql.Timestamp execution-time)
                        (.toLocalDateTime execution-time)
                        execution-time)
            exec-hour (.getHour exec-time)
            exec-minute (.getMinute exec-time)
            exec-day-of-week (-> (.getDayOfWeek exec-time)
                     str
                     clojure.string/lower-case
                     (subs 0 3))

            exec-day-of-month (.getDayOfMonth exec-time)
            {:keys [schedule_type schedule_hour schedule_day schedule_frame]} channel
            safe-schedule-hour (safe-parse-int schedule_hour 0)
            safe-schedule-frame (safe-parse-int schedule_frame 1)
            schedule-type-keyword (keyword schedule_type)]
        (and
         (= exec-minute 0) ;; Enforce top-of-hour execution
         (case schedule-type-keyword
           :hourly
           (if (nil? schedule_hour)
             true 
             (= (mod exec-hour safe-schedule-hour) 0))

           :daily
           (= exec-hour safe-schedule-hour)

           :weekly
           (and (= exec-hour safe-schedule-hour)
                (= exec-day-of-week schedule_day))

           :monthly
           (and (= exec-hour safe-schedule-hour)
                (= exec-day-of-month safe-schedule-frame))

           false)))
      (catch Exception e
        (log/warn "Error matching pulse schedule:" e)
        false))))


(defn- get-pulse-last-scheduled-execution
  "Get the last scheduled execution time for a pulse by querying pulse_card_file table.
   Only returns executions that match the pulse's actual schedule (ignoring manual sends).
   Assumes a single enabled email channel per pulse."
  [pulse-id]
  (let [;; Fetch the enabled email channel for this pulse
        email-channel (db/select-one PulseChannel
                         :pulse_id pulse-id
                         :enabled true
                         :channel_type "email")

        ;; Get all executions in reverse-chronological order
        executions (db/select [PulseCardFile :created_at]
                              :pulse_id pulse-id
                              {:order-by [[:created_at :desc]]})

        ;; Find first execution that matches the schedule
        last-scheduled-execution (when email-channel
                                   (some #(when (matches-pulse-schedule? (:created_at %) email-channel) %)
                                         executions))]
    
    {:pulse_id pulse-id
     :last_scheduled_execution (:created_at last-scheduled-execution)
     :schedule_info (if email-channel
                      [(select-keys email-channel [:schedule_type :schedule_hour :schedule_day :schedule_frame])]
                      [])}))


(api/defendpoint GET "/:id/last-execution"
  "Get last scheduled execution info for a pulse based on pulse_card_file entries."
  [id]
  (api/read-check Pulse id)
  (get-pulse-last-scheduled-execution id))

(api/define-routes)
