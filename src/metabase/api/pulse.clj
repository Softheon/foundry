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
             [pulse-channel :refer [channel-types]]
             [user :as user :refer [User]]]
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

(defn- with-impersonated-user
  "Execute function f with temporarily impersonated user context if X-Impersonate-User header is present.
   This is specifically for pulse agents that need to access personal collections."
  [request f]
  (if-let [impersonate-email (get-in request [:headers "x-impersonate-user"])]
    ;; Only allow impersonation if current user is a pulse user (service account)
    (if api/*is-pulse-user?*
      (if-let [target-user (db/select-one [User :id :is_superuser] :email impersonate-email :is_active true)]
        ;; Temporarily bind the impersonated user context
        (binding [api/*current-user-id* (:id target-user)
                  api/*is-superuser?* (:is_superuser target-user)
                  api/*current-user* (delay target-user)
                  api/*current-user-permissions-set* (delay (user/permissions-set (:id target-user)))]
          (f))
        ;; Target user not found
        (api/check-400 false))
      ;; Not authorized to impersonate
      (api/check-403 false))
    ;; No impersonation header, proceed normally
    (f)))

(api/defendpoint POST "/test"
  "Test send an unsaved pulse."
  [:as {{:keys [name cards channels skip_if_empty collection_id collection_position] :as body} :body, :as request}]
  {name                su/NonBlankString
   cards               (su/non-empty [pulse/CoercibleToCardRef])
   channels            (su/non-empty [su/Map])
   skip_if_empty       (s/maybe s/Bool)
   collection_id       (s/maybe su/IntGreaterThanZero)
   collection_position (s/maybe su/IntGreaterThanZero)}
  (api/check-pulse-permission)
  (with-impersonated-user request
    (fn []
      (check-card-read-permissions cards)
      (p/send-pulse! body)))
  {:ok true})

(defn- get-pulse-last-execution
  "Get the last execution time for a pulse by querying pulse_card_file table.
   Returns the most recent execution regardless of whether it was scheduled or manual."
  [pulse-id]
  (let [;; Get the most recent execution
        last-execution (db/select-one [PulseCardFile :created_at]
                                      :pulse_id pulse-id
                                      {:order-by [[:created_at :desc]]})]
    
    {:pulse_id pulse-id
     :last_execution (:created_at last-execution)}))


(api/defendpoint GET "/:id/last-execution"
  "Get last execution info for a pulse based on pulse_card_file entries."
  [id]
  (api/check-pulse-permission)
  (api/read-check Pulse id)
  (get-pulse-last-execution id))

(api/define-routes)
