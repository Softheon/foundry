(ns metabase.integrations.iam
  (:require [cheshire.core :as json]
            [clj-http.client :as http]
            [clojure.java.io :as io]
            [clojure.tools.logging :as log]
            [metabase.models
             [permissions-group :as group :refer [PermissionsGroup]]
             [setting :as setting :refer [defsetting]]
             [user :as user :refer [User]]]
            [metabase
             [config :as config]
             [util :as u]]
            [metabase.util.i18n :refer [tru]]
            [metabase.toucan.db :as db]))


(defn iam-configured?
  []
  (boolean (and (config/config-str :iam-token-endpoint)
                (config/config-str :iam-client-id)
                (config/config-str :iam-client-secret)
                (config/config-str :iam-grant-type)
                (config/config-str :iam-api-user-info))))

(defn- do-iam-request
  [request-fn params-key iam-api-base-url endpoint
   {:keys [token] :as params}]
  (request-fn
   (str iam-api-base-url (if endpoint
                           (str "/" (name endpoint))
                           ""))
   (cond-> {:as :json
            :socket-timeout 10000
            :conn-timeout 10000}
     params-key (assoc
                 (keyword params-key)
                 (dissoc params :token))
     token  (assoc :oauth-token token))))

(def ^{:arglists '([endpoint & {:as params}]), :style/indent 1}
  POST
  "Make a POST request to teh IAM  API"
  (partial do-iam-request http/post :form-params))

(defn- get-token
  [base-url endpoint params]
  (let [{:keys [status body]} (POST base-url endpoint params)]
    (if (and (= 200 status) (:access_token body))
      (:access_token body)
      (let [error {:message (str "Unable to obtain token:" (:error body)), :response body}]
        (log/warn (u/pprint-to-str 'red error))
        (throw (ex-info (:message error) error))))))

(defn- get-user-info
  [base-url endpoint params]
  (let [{:keys [status body]} (POST base-url nil params)]
    (if (and (= 200 status)
             (:given_name body)
             (:family_name body)
             (:email body))
      {:first-name (:given_name body)
       :last-name (:family_name body)
       :email (:email body)}
      (let [error {:message (str "Unable to get user information:" (:error body)), :response body}]
        (log/warn (u/pprint-to-str 'red error))
        (throw (ex-info (:message error) error))))))


(defn find-user
  [username password]
  (let [form-params {:client_id (config/config-str :iam-client-id)
                     :client_secret (config/config-str :iam-client-secret)
                     :grant_type (config/config-str :iam-grant-type)
                     :username username
                     :password password}
        token (get-token (config/config-str :iam-api-base-url)
                         (config/config-str :iam-token-endpoint) form-params)]
    (when token
      (get-user-info (config/config-str :iam-api-user-info) nil {:token token}))))

(defn fetch-or-create-user!
  "Using the `user-info` (from `find-user`) get the corresponding Foundry user, creating it if 
necessary."
  [{:keys [first-name last-name email groups]} password]
  (let [user (or (db/select-one [User :id :last_login] :email email)
                 (user/create-new-iam-auth-user! {:first_name first-name
                                                  :last_name last-name
                                                  :email email}))]
    user))