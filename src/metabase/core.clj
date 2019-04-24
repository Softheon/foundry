;; -*- comment-column: 35; -*-
(ns metabase.core
  (:gen-class)
  (:require [clojure.tools.logging :as log]
            [metabase
             [config :as config]
             [db :as mdb]
             [driver :as driver]
             [events :as events]
             [handler :as handler]
             [metabot :as metabot]
             [plugins :as plugins]
             [sample-data :as sample-data]
             [server :as server]
             [setup :as setup]
             [task :as task]
             [util :as u]]
            [metabase.core.initialization-status :as init-status]
            [metabase.models
             [setting :as setting]
             [user :refer [User]]]
            [metabase.util.i18n :refer [set-locale trs]]
            [metabase.toucan.db :as db])
  (:import [java.io BufferedWriter OutputStream OutputStreamWriter]
           [java.nio.charset Charset StandardCharsets]
           org.eclipse.jetty.server.Server
           org.eclipse.jetty.util.thread.QueuedThreadPool))


;;; --------------------------------------------------- Lifecycle ----------------------------------------------------

(defn- -init-create-setup-token
  "Create and set a new setup token and log it."
  []
  (let [setup-token (setup/create-token!)                    ; we need this here to create the initial token
        hostname    (or (config/config-str :mb-jetty-host) "localhost")
        port        (config/config-int :mb-jetty-port)
        setup-url   (str "http://"
                         (or hostname "localhost")
                         (when-not (= 80 port) (str ":" port))
                         "/setup/")]
    (log/info (u/format-color 'green
                  (str (trs "Please use the following URL to setup your Foundry installation:")
                       "\n\n"
                       setup-url
                       "\n\n")))))

(defn- destroy!
  "General application shutdown function which should be called once at application shuddown."
  []
  (log/info (trs "Foundry Shutting Down ..."))
  (task/stop-scheduler!)
  (log/info (trs "Foundry Shutdown COMPLETE")))


(defn init!
  "General application initialization function which should be run once at application startup."
  []
  (log/info (trs "Starting Foundry version {0} ..." config/mb-version-string))
  (log/info (trs "System timezone is ''{0}'' ..." (System/getProperty "user.timezone")))
  (init-status/set-progress! 0.1)

  ;; First of all, lets register a shutdown hook that will tidy things up for us on app exit
  (.addShutdownHook (Runtime/getRuntime) (Thread. ^Runnable destroy!))
  (init-status/set-progress! 0.2)

  ;; load any plugins as needed
  (plugins/load-plugins!)
  (init-status/set-progress! 0.3)
  (plugins/setup-plugins!)
  (init-status/set-progress! 0.35)

  ;; Load up all of our Database drivers, which are used for app db work
  (driver/find-and-load-drivers!)
  (init-status/set-progress! 0.4)

  ;; startup database.  validates connection & runs any necessary migrations
  (log/info (trs "Setting up and migrating Foundry DB. Please sit tight, this may take a minute..."))
  (mdb/setup-db! :auto-migrate (config/config-bool :mb-db-automigrate))
  (init-status/set-progress! 0.5)

  ;; run a very quick check to see if we are doing a first time installation
  ;; the test we are using is if there is at least 1 User in the database
  (let [new-install? (not (db/exists? User))]

    ;; Bootstrap the event system
    (events/initialize-events!)
    (init-status/set-progress! 0.7)

    ;; Now start the task runner
    (task/start-scheduler!)
    (init-status/set-progress! 0.8)

    (when new-install?
      (log/info (trs "Looks like this is a new installation ... preparing setup wizard"))
      ;; create setup token
      (-init-create-setup-token)
      ;; publish install event
      (events/publish-event! :install {}))
    (init-status/set-progress! 0.9)

    ;; deal with our sample dataset as needed
    (if new-install?
      ;; add the sample dataset DB for fresh installs
      (sample-data/add-sample-dataset!)
      ;; otherwise update if appropriate
      (sample-data/update-sample-dataset-if-needed!))

    ;; start the metabot thread
    (metabot/start-metabot!))

  (set-locale (setting/get :site-locale))

  (init-status/set-complete!)
  (log/info (trs "Foundry Initialization COMPLETE")))


;;; -------------------------------------------------- Normal Start --------------------------------------------------

(defn- start-normally []
  (log/info (trs "Starting Foundry in STANDALONE mode"))
  (try
    ;; launch embedded webserver async
    (server/start-web-server! handler/app)
    ;; run our initialization process
    (init!)
    ;; Ok, now block forever while Jetty does its thing
    (when (config/config-bool :mb-jetty-join)
      (.join (server/instance)))
    (catch Throwable e
      (log/error e (trs "Foundry Initialization FAILED"))
      (System/exit 1))))

(defn- run-cmd [cmd args]
  (require 'metabase.cmd)
  ((resolve 'metabase.cmd/run-cmd) cmd args))


;;; ------------------------------------------------ App Entry Point -------------------------------------------------

(defn -main
  "Launch Foundry in standalone mode."
  [& [cmd & args]]
  (if cmd
    (run-cmd cmd args) ; run a command like `java -jar metabase.jar migrate release-locks` or `lein run migrate release-locks`
    (start-normally))) ; with no command line args just start Foundry normally
