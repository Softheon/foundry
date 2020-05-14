/* @flow */

// Reducers needed for manager section (only used in "main" app)
import people from "metabase/manager/people/people";

import permissions from "metabase/manager/permissions/permissions";


import { combineReducers } from "metabase/lib/redux";

export default combineReducers({
  people,
  permissions,
});
