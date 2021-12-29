(ns metabase.logger
  (:require [amalloy.ring-buffer :refer [ring-buffer]]
            [clj-time
             [coerce :as coerce]
             [core :as t]
             [format :as time]]
            [clojure.string :as str])
  (:import org.apache.commons.lang3.exception.ExceptionUtils
           [org.apache.logging.log4j.core Appender LogEvent LoggerContext]
           org.apache.logging.log4j.core.config.LoggerConfig
           org.apache.logging.log4j.LogManager))

(def ^:private ^:const max-log-entries 2500)

(defonce ^:private messages* (atom (ring-buffer max-log-entries)))

(defn messages
  "Get the list of currently buffered log entries, from most-recent to oldest."
  []
  (reverse (seq @messages*)))

(defonce ^:private formatter (time/formatter "MMM dd HH:mm:ss" (t/default-time-zone)))

(defn- event->log-string [^LogEvent event]
  ;; for messages that include an Exception, include the string representation of it (i.e., its stacktrace)
  ;; separated by newlines
  (str/join
   "\n"
   (cons
    (let [ts    (time/unparse (time/formatter :date-time)
                              (coerce/from-long (.getTimeMillis event)))
          level (.getLevel event)
          fqns  (.getLoggerName event)
          msg   (.getMessage event)]
      (format "%s \033[1m%s %s\033[0m :: %s" ts level fqns msg))
    (when-let [throwable (.getThrown event)]
      (ExceptionUtils/getStackFrames throwable)))))


(defn- metabase-appender ^Appender []
  (let [^org.apache.logging.log4j.core.Filter filter                   nil
        ^org.apache.logging.log4j.core.Layout layout                   nil
        ^"[Lorg.apache.logging.log4j.core.config.Property;" properties nil]
    (proxy [org.apache.logging.log4j.core.appender.AbstractAppender]
           ["metabase-appender" filter layout false properties]
      (append [event]
        (swap! messages* conj (event->log-string event))
        nil))))

(defonce ^:private has-added-appender? (atom false))

(when-not *compile-files*
  (when-not @has-added-appender?
    (reset! has-added-appender? true)
    (let [^LoggerContext ctx                           (LogManager/getContext false)
          config                                       (.getConfiguration ctx)
          appender                                     (metabase-appender)
          ^org.apache.logging.log4j.Level level        nil
          ^org.apache.logging.log4j.core.Filter filter nil]
      (.start appender)
      (.addAppender config appender)
      (doseq [[_ ^LoggerConfig logger-config] (.getLoggers config)]
        (.addAppender logger-config appender level filter))
      (.updateLoggers ctx))))