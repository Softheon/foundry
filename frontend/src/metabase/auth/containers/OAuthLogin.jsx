import React, { Component } from "react";
import { findDOMNode } from "react-dom";
import { connect } from "react-redux";
import { t } from "c-3po";
import querystring from "querystring";
import { Link } from "react-router";
import SSOLoginButton from "../components/SSOLoginButton.jsx";
import {
  SERVER_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
} from "metabase/components/form/FormMessage.jsx";
import LogoIcon from "metabase/components/LogoIcon.jsx";
import Settings from "metabase/lib/settings";
import Button from "metabase/components/Button";
import CheckBox from "metabase/components/CheckBox.jsx";
import FormField from "metabase/components/form/FormField.jsx";
import FormLabel from "metabase/components/form/FormLabel.jsx";
import FormMessage from "metabase/components/form/FormMessage.jsx";
import Utils from "metabase/lib/utils";
import LoadingSpinner from "metabase/components/LoadingSpinner.jsx";

import * as authActions from "../auth";
import { retry } from "rxjs/operator/retry";

const mapStateToProps = (state, props) => {
  return {
    loginError: state.auth && state.auth.loginError,
    user: state.currentUser,
  };
};

const mapDispatchToProps = {
  ...authActions,
};

@connect(mapStateToProps, mapDispatchToProps)
export default class OAuthLogin extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      credentials: {},
      valid: false,
      rememberMe: true,
      isLoading: false,
    };
  }

  validateForm() {
    let { credentials } = this.state;

    let valid = true;

    if (!credentials.username || !credentials.password) {
      valid = false;
    }

    if (this.state.valid !== valid) {
      this.setState({ valid });
    }
  }

  onSSOButtonClick = (e) => {
    e.preventDefault();
    let url = Settings.get("iam_authorization_endpoint");
    const { location } = this.props;
    const data = {
      client_id: Settings.get("iam_auth_client_id"),
      scope: "openid profile email",
      response_type: "id_token token",
      redirect_uri: Settings.get("iam_auth_redirect"),
      state: location.query.redirect,
      nonce: "foundry",
    };
    const params = querystring.stringify(data);

    url += (url.indexOf("?") >= 0 ? "&" : "?") + params;
    window.location = url;
  };

  componentDidMount() {
    this.validateForm();
    if (!Settings.iamEnabled()) {
      return;
    }
    const { loginIAM } = this.props;
    const currentUrl = window.location.href;
    const matches = currentUrl.match(
      /\#(?:id_token)\=([\S\s]*?)\&(?:access_token)\=([\S\s]*?)\&/,
    );

    try {
      if (matches && matches.length >= 3) {
        const id_token = matches[1];
        const access_token = matches[2];
        this.setState({
          isLoading: true,
        });
        const redirectUrl = currentUrl.match(
          /\&(?:state)\=([\S\s]*?)\&/
        );
        const redirect = decodeURIComponent(redirectUrl[1]);
        loginIAM({ id_token, access_token }, redirect);
      }
    } catch (error) {
      console.error("There was an error logging in", error);
    }
  }

  componentDidUpdate() {
    this.validateForm();
  }

  onChangeUserName(fieldName, fieldValue) {
    this.onChange(fieldName, fieldValue.trim());
  }

  onChange(fieldName, fieldValue) {
    this.setState({
      credentials: { ...this.state.credentials, [fieldName]: fieldValue },
    });
  }

  formSubmitted(e) {
    e.preventDefault();

    let { login, location } = this.props;
    let { credentials } = this.state;
    this.setState({
      isLoading: true,
    });
    login(credentials, location.query.redirect);
  }

  render() {
    const { loginError } = this.props;
    const isLoading = !loginError && this.state.isLoading;

    if (Settings.emailLoginEnabled()) {
      return (
        <div className="full bg-white flex flex-column flex-full md-layout-centered">
          <div
            className="Login-wrapper wrapper Grid Grid--full md-Grid--1of2 md-layout-centered relative z2
          max-w-70"
          >
            <div className="Grid-cell flex layout-centered text-brand">
              <LogoIcon className="Logo my4 sm-my0" width={66} height={85} />
            </div>
            <div className="Login-content Grid-cell">
              <form
                className="Form-new bg-white bordered rounded shadowed"
                name="form"
                onSubmit={(e) => this.formSubmitted(e)}
              >
                <h3 className="Login-header Form-offset">{t`Sign in to Foundry`}</h3>

                {Settings.iamEnabled() && (
                  <div className="mx4 mb4 py3 border-bottom relative flex layout-centered">
                    <SSOLoginButton
                      provider="Softheon"
                      onClick={this.onSSOButtonClick}
                    />
                    {/*<div className="g-signin2 ml1 relative z2" id="g-signin2"></div>*/}
                    <div
                      className="mx1 absolute text-centered left right"
                      style={{ bottom: -8 }}
                    >
                      <span className="text-bold px3 py2 text-medium bg-white">{t`OR`}</span>
                    </div>
                  </div>
                )}

                <FormMessage
                  formError={
                    loginError && loginError.data.message ? loginError : null
                  }
                />

                <FormField
                  key="username"
                  fieldName="username"
                  formError={loginError}
                >
                  <FormLabel
                    title={t`Username or email address`}
                    fieldName={"username"}
                    formError={loginError}
                  />
                  <input
                    className="Form-input Form-offset full py1"
                    name="username"
                    placeholder="foundry@email.com"
                    type={"text"}
                    onChange={(e) => this.onChange("username", e.target.value)}
                    autoFocus
                  />
                  <span className="Form-charm" />
                </FormField>

                <FormField
                  key="password"
                  fieldName="password"
                  formError={loginError}
                >
                  <FormLabel
                    title={t`Password`}
                    fieldName={"password"}
                    formError={loginError}
                  />
                  <input
                    className="Form-input Form-offset full py1"
                    name="password"
                    placeholder="Shh..."
                    type="password"
                    onChange={(e) => this.onChange("password", e.target.value)}
                  />
                  <span className="Form-charm" />
                </FormField>

                <div className="Form-field">
                  <div className="Form-offset flex align-center">
                    <CheckBox
                      name="remember"
                      checked={this.state.rememberMe}
                      onChange={() =>
                        this.setState({ rememberMe: !this.state.rememberMe })
                      }
                    />
                    <span className="ml1">{t`Remember Me`}</span>
                  </div>
                </div>

                <div className="p4 flex flex-column">
                  <Button
                    primary={this.state.valid}
                    disabled={!this.state.valid}
                    className={"Button--blue"}
                  >
                    {t`Sign in`}
                  </Button>
                  <Link
                    to={
                      "/auth/forgot_password" +
                      (Utils.validEmail(this.state.credentials.username)
                        ? "?email=" + this.state.credentials.username
                        : "")
                    }
                    className="Grid-cell py1 sm-py0 md-text-center text-centered flex-full link"
                    onClick={(e) => {
                      window.OSX ? window.OSX.resetPassword() : null;
                    }}
                  >{t`Forgot password`}</Link>
                  {Settings.ligthouseUrl() && (
                    <a
                      className="sm-py0 text-centered  link"
                      target="_blank"
                      href={Settings.ligthouseUrl()}
                    >{t`Request Access`}</a>
                  )}
                </div>
              </form>
            </div>
          </div>
          {isLoading && (
            <div
              className="Loading spread flex flex-column layout-centered text-brand z2"
              style={{ zIndex: 50 }}
            >
              <LoadingSpinner />
              <h2 className="Loading-message text-brand text-uppercase my3">
                {t`Loading ...`}
              </h2>
            </div>
          )}
        </div>
      );
    }

    let errorMsg = null;
    if (loginError) {
      if (loginError.status >= 400) {
        errorMsg = SERVER_ERROR_MESSAGE;
      } else {
        errorMsg = UNKNOWN_ERROR_MESSAGE;
      }
    }
    return (
      <div className="full bg-white flex flex-column flex-full md-layout-centered">
        <div
          className="Login-wrapper wrapper Grid Grid--full  md-layout-centered relative z2
        flex-flow max-w-70"
        >
          <div className="Grid-cell flex layout-centered text-brand">
            <LogoIcon className="Logo my4 sm-my0" width={66} height={85} />
          </div>
          {!isLoading && (
            <div className="Login-content Grid-cell SuccessText">
              <div>
                <h3 className="Login-header">{t`Welcome to Foundry`}</h3>
                {Settings.iamEnabled() && (
                  <div className="mx4 mb4 py3  relative flex layout-centered">
                    <SSOLoginButton
                      provider="Softheon"
                      onClick={this.onSSOButtonClick}
                    />
                    {/*<div className="g-signin2 ml1 relative z2" id="g-signin2"></div>*/}
                    <div
                      className="mx1 absolute left right"
                      style={{ bottom: -15 }}
                    >
                      {errorMsg && (
                        <span className="text-error">{errorMsg}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {isLoading && (
          <div
            className="Loading spread flex flex-column layout-centered text-brand z2"
            style={{ zIndex: 50 }}
          >
            <LoadingSpinner />
            <h2 className="Loading-message text-brand text-uppercase my3">
              {t`Loading ...`}
            </h2>
          </div>
        )}
      </div>
    );
  }
}
