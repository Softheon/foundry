import React from "react";
import { Route } from "metabase/hoc/Title";
import { IndexRoute, IndexRedirect } from "react-router";
import { t } from "c-3po";
import { withBackground } from "metabase/hoc/Background";

import PeopleApp from "metabase/manager/people/containers/PeopleApp.jsx";
// People
import PeopleListingApp from "metabase/manager/people/containers/PeopleListingApp.jsx";
import GroupsListingApp from "metabase/manager/people/containers/GroupsListingApp.jsx";
import GroupDetailApp from "metabase/manager/people/containers/GroupDetailApp.jsx";
import getManagerPermissionsRoutes from "metabase/manager/permissions/routes.jsx";

const getRoutes = (store, IsAdmin) => (
  <Route
    path="/manager"
    title={t`Manager`}
    component={withBackground("bg-white")(IsAdmin)}>
    <IndexRedirect to="/manager/people" />
    {/* PEOPLE */}
    <Route path="people" title={t`People`} component={PeopleApp}>
      <IndexRoute component={PeopleListingApp} />
      <Route path="groups" title={t`Groups`}>
        <IndexRoute component={GroupsListingApp} />
        <Route path=":groupId" component={GroupDetailApp} />
      </Route>
    </Route>
    {getManagerPermissionsRoutes(store)}
  </Route>
)

export default getRoutes;
