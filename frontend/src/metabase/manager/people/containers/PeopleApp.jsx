/* eslint "react/prop-types": "warn" */
import React, { Component } from "react";
import PropTypes from "prop-types";
import { t } from "c-3po";

import {
  LeftNavPane,
  LeftNavPaneItem,
} from "metabase/components/LeftNavPane.jsx";

import AdminLayout from "metabase/components/AdminLayout.jsx";

export default class PeopleApp extends Component {

  render() {
    const { children } = this.props;
    return (
      <AdminLayout
        sidebar={
          <LeftNavPane>
            <LeftNavPaneItem name={t`People`} path="/manager/people" index />
            <LeftNavPaneItem name={t`Groups`} path="/manager/people/groups" />
          </LeftNavPane>
        }
      >
        {children}
      </AdminLayout>
    );
  }
}

