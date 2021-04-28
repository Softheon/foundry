import React, { Component } from "react";
import PropTypes from "prop-types";
import cx from "classnames";
import _ from "underscore";
import { t, jt } from "c-3po";

import Breadcrumbs from "metabase/components/Breadcrumbs.jsx";
import InputBlurChange from "metabase/components/InputBlurChange.jsx";

export default class SettingsIdsSingleSignOnForm extends Component {
  constructor(props, context) {
    super(props, context);
  }

  static propTypes = {
    elements: PropTypes.array,
    updateSetting: PropTypes.func.isRequired,
  };

  componentWillMount() {
    let { elements } = this.props;
    const clientID = _.findWhere(elements, { key: "ids-auth-client-id" });
    const authorizeApi = _.findWhere(elements, { key: "ids-auth-authorize-api" });
    const userInfoApi = _.findWhere(elements, { key: "ids-auth-user-info-api" });
    const clientRedirectUrl = _.findWhere(elements, { key: "ids-auth-client-redirect-url" });
    this.setState({
      clientID: clientID,
      authorizeApi: authorizeApi,
      userInfoApi: userInfoApi,
      clientRedirectUrl: clientRedirectUrl,
      clientIDValue: clientID.value,
      authorizeApiValue: authorizeApi.value,
      userInfoApiValue: userInfoApi.value,
      clientRedirectUrlValue: clientRedirectUrl.value,
      recentlySaved: false,
    });
  }

  updateClientID = newValue => {
    if (newValue === this.state.clientIDValue) {
      return;
    }

    this.setState({
      clientIDValue: newValue && newValue.length ? newValue : null,
      recentlySaved: false,
    });
  }

  updateAuthorizeApi = newValue => {
    if (newValue === this.state.authorizeApiValue) {
      return;
    }

    this.setState({
      authorizeApiValue: newValue && newValue.length ? newValue : null,
      recentlySaved: false,
    });
  }

  updateUserInfoApi = newValue => {
    if (newValue === this.state.userInfoApiValue) {
      return;
    }

    this.setState({
      userInfoApiValue: newValue && newValue.length ? newValue : null,
      recentlySaved: false,
    });
  }

  updateClientRedirectUrl = newValue => {
    if (newValue === this.state.clientRedirectUrlValue) {
      return;
    }

    this.setState({
      clientRedirectUrlValue: newValue && newValue.length ? newValue : null,
      recentlySaved: false,
    });
  }

  clientIDChanged = () => {
    return this.state.clientID.value !== this.state.clientIDValue;
  }

  authorizeApiChanged = () => {
    return this.state.authorizeApi.value !== this.state.authorizeApiValue;
  }

  userInfoApiChanged = () => {
    return this.state.userInfoApi.value !== this.state.userInfoApiValue;
  }

  clientRedirectUrlChanged = () => {
    return this.state.clientRedirectUrl.value !== this.state.clientRedirectUrlValue;
  }


  saveChanges = () =>  {
    let {
      clientID,
      authorizeApi,
      userInfoApi,
      clientRedirectUrl,
      clientIDValue,
      authorizeApiValue,
      userInfoApiValue,
      clientRedirectUrlValue,
    } = this.state;

    if (this.clientIDChanged()) {
      this.props.updateSetting(clientID, clientIDValue);
      console.log("updating client id", clientID, clientIDValue)
      this.setState({
        clientID: {
          value: clientIDValue,
        },
        recentlySaved: true,
      });
    }

    if (this.authorizeApiChanged()) {
      this.props.updateSetting(authorizeApi, authorizeApiValue);
      this.setState({
        authorizeApi: {
          value: authorizeApiValue,
        },
        recentlySaved: true,
      });
    }

    if (this.userInfoApiChanged()) {
      this.props.updateSetting(userInfoApi, userInfoApiValue);
      this.setState({
        userInfoApi: {
          value: userInfoApiValue,
        },
        recentlySaved: true,
      });
    }

    if (this.clientRedirectUrlChanged()) {
      this.props.updateSetting(clientRedirectUrl, clientRedirectUrlValue);
      this.setState({
        clientRedirectUrl: {
          value: clientRedirectUrlValue,
        },
        recentlySaved: true,
      });
    }
  }

  render() {
    let hasChanges = this.clientIDChanged() || this.userInfoApiChanged() || this.authorizeApiChanged()
      || this.clientRedirectUrlChanged();

    const hasClientID = this.state.clientIDValue;

    return (
      <form onSubmit={null} noValidate>
        <div className="px2" style={{ maxWidth: "585px" }}>
          <Breadcrumbs
            crumbs={[
              [t`Authentication`, "/admin/settings/authentication"],
              [t`Identity Service Sign-In`],
            ]}
            className="mb2"
          />
          <h2>{t`Sign in with Identity Service`}</h2>
          
          <p className="text-medium">
            {t`IDS client id,`}
          </p>
          <InputBlurChange
            className="SettingsInput AdminInput bordered rounded h3"
            type="text"
            value={this.state.clientIDValue}
            placeholder={t`Your IDS client ID`}
            onChange={event => this.updateClientID(event.target.value)}
          />
          
          <p className="text-medium">
            {t`IDS authorize endpoint`}
          </p>
          <InputBlurChange
            className="SettingsInput AdminInput bordered rounded h3"
            type="text"
            value={this.state.authorizeApiValue}
            placeholder={t`The endpoint to authorize the user`}
            onChange={event => this.updateAuthorizeApi(event.target.value)}
            disabled={!hasClientID}
          />

          <p className="text-medium">
            {t`IDS user information endpoint`}
          </p>
          <InputBlurChange
            className="SettingsInput AdminInput bordered rounded h3"
            type="text"
            value={this.state.userInfoApiValue}
            placeholder={t`The endpoint to obtain user information`}
            onChange={event => this.updateUserInfoApi(event.target.value)}
            disabled={!hasClientID}
          />

          <p className="text-medium">
            {t`IDS client redirect url`}
          </p>
          <InputBlurChange
            className="SettingsInput AdminInput bordered rounded h3"
            type="text"
            value={this.state.clientRedirectUrlValue}
            placeholder={t`Client Redirect URL`}
            onChange={event => this.updateClientRedirectUrl(event.target.value)}
            disabled={!hasClientID}
          />
          <div className="py3">
          </div>

          <button
            className={cx("Button mr2", { "Button--primary": hasChanges })}
            disabled={!hasChanges}
           onClick={this.saveChanges}
          >
            {this.state.recentlySaved ? t`Changes saved!` : t`Save Changes`}
          </button>
        </div>
      </form>
    );

  }
}
