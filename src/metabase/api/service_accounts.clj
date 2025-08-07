(ns metabase.api.service-accounts
  "Service account utilities for API endpoints."
  (:require [metabase.api.common :as api]
            [metabase.toucan.db :as db]
            [metabase.models.permissions-group :as group :refer [PermissionsGroup]]
            [metabase.models.permissions-group-membership :refer [PermissionsGroupMembership]]))

(defn is-service-account?
  "Check if the current user is a service account (member of 'Service Accounts' group)."
  []
  (when api/*current-user-id*
    (db/exists? PermissionsGroupMembership 
               :group_id (:id (group/service-accounts))
               :user_id api/*current-user-id*)))

(defn service-account-read-check
  "Read check that allows service accounts to bypass collection restrictions."
  [model id]
  (if (is-service-account?)
    ;; Service accounts can read any entity, just verify it exists and isn't archived
    (let [entity (db/select-one model :id id :archived false)]
      (api/check-404 entity)
      entity)
    ;; Regular users use normal permission checks
    (api/read-check model id)))
