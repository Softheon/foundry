import { clearGoogleAuthCredentials } from "metabase/lib/auth";

import Cookies from "js-cookie";

export const METABASE_SESSION_COOKIE = "metabase.SESSION_ID";
export const METABASE_SEEN_ALERT_SPLASH_COOKIE = "metabase.SEEN_ALERT_SPLASH";
export const BNES_METABASE_SESSION_ID = "BNES_metabase.SESSION_ID";
export const BNES_METABASE_SESSION = "BNES_metabase.SESSION";
// Handles management of Foundry cookie work
let MetabaseCookies = {
  // set the session cookie.  if sessionId is null, clears the cookie
  setSessionCookie: function(sessionId) {
    const options = {
      path: window.MetabaseRoot || "/",
      expires: 14,
      secure: window.location.protocol === "https:",
    };

    try {
      if (sessionId) {
        // set a session cookie
        Cookies.set(METABASE_SESSION_COOKIE, sessionId, options);
        Cookies.remove(BNES_METABASE_SESSION_ID);
      } else {
        sessionId = Cookies.get(METABASE_SESSION_COOKIE);
        Cookies.remove(BNES_METABASE_SESSION_ID);

        // delete the current session cookie and Google Auth creds
        Cookies.remove(METABASE_SESSION_COOKIE);
        clearGoogleAuthCredentials();

        return sessionId;
      }
    } catch (e) {
      console.error("setSessionCookie:", e);
    }
  },
  removeBNESCookies :  () => {
    // Cookies.remove(METABASE_SESSION_COOKIE, {path: "", domain " });
    // Cookies.remove(BNES_METABASE_SESSION_ID);
    // Cookies.remove(BNES_METABASE_SESSION);
    document.cookie =`${BNES_METABASE_SESSION}=;path=/; Max-Age=-1;`
    document.cookie =`${BNES_METABASE_SESSION}=;path=/api; Max-Age=-1;`
    document.cookie =`${BNES_METABASE_SESSION_ID}=;path=/; Max-Age=-1;`
    document.cookie =`${METABASE_SESSION_COOKIE}=;path=/; Max-Age=-1;`
  },
  setHasSeenAlertSplash: hasSeen => {
    const options = {
      path: window.MetabaseRoot || "/",
      expires: 365,
      secure: window.location.protocol === "https:",
    };

    try {
      Cookies.set(METABASE_SEEN_ALERT_SPLASH_COOKIE, hasSeen, options);
    } catch (e) {
      console.error("setSeenAlertSplash:", e);
    }
  },

  getHasSeenAlertSplash: () => {
    try {
      return Cookies.get(METABASE_SEEN_ALERT_SPLASH_COOKIE) || false;
    } catch (e) {
      console.error("getSeenAlertSplash:", e);
      return false;
    }
  },
};

export default MetabaseCookies;
