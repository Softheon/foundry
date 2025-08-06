(ns metabase.query-processor.middleware.permissions
  "Middleware for checking that the current user has permissions to run the current query."
  (:require [metabase.api.common :refer [*current-user-id* *current-user-permissions-set*]]
            [metabase.models
             [card :refer [Card]]
             [interface :as mi]
             [permissions :as perms]]
            [metabase.models.query.permissions :as query-perms]
            [metabase.util
             [i18n :refer [tru]]
             [schema :as su]]
            [schema.core :as s]
            [metabase.toucan.db :as db]
            [metabase.api.service-accounts :as service-accounts]))

(s/defn ^:private check-card-read-perms
  "Check that the current user has permissions to read Card with `card-id`, or throw an Exception. "
  [card-id :- su/IntGreaterThanZero]
  ;; Use service account read check which bypasses collection restrictions for service accounts
  (try
    (service-accounts/service-account-read-check Card card-id)
    (catch clojure.lang.ExceptionInfo e
      ;; Re-throw with a more specific message for query processor context
      (if (= 404 (:status-code (ex-data e)))
        (throw (Exception. (str (tru "Card {0} does not exist." card-id))))
        (throw (Exception. (str (tru "You do not have permissions to view Card {0}." card-id))))))))

(s/defn ^:private check-ad-hoc-query-perms
  [outer-query]
  (when-not (perms/set-has-full-permissions-for-set? @*current-user-permissions-set*
              (query-perms/perms-set outer-query, :throw-exceptions? true, :already-preprocessed? true))
    (throw (Exception. (str (tru "You do not have permissions to run this query."))))))

(s/defn ^:private check-query-permissions*
  "Check that User with `user-id` has permissions to run `query`, or throw an exception."
  [{{:keys [card-id]} :info, :as outer-query} :- su/Map]
  (when *current-user-id*
    (if card-id
      (check-card-read-perms card-id)
      (check-ad-hoc-query-perms outer-query)))
  outer-query)

(defn check-query-permissions
  "Middleware that check that the current user has permissions to run the current query. This only applies if
  `*current-user-id*` is bound. In other cases, like when running public Cards or sending pulses, permissions need to
  be checked separately before allowing the relevant objects to be create (e.g., when saving a new Pulse or
  'publishing' a Card)."
  [qp]
  (comp qp check-query-permissions*))
