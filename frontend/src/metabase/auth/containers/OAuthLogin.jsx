import React, { Component } from "react";
import { findDOMNode } from "react-dom";
import { Link } from "react-router";
import { connect } from "react-redux";

import { t } from "c-3po";
import AuthScene from "../components/AuthScene.jsx";
import SSOLoginButton from "../components/SSOLoginButton.jsx";
import Button from "metabase/components/Button";
import CheckBox from "metabase/components/CheckBox";
import FormField from "metabase/components/form/FormField.jsx";
import FormLabel from "metabase/components/form/FormLabel.jsx";
import FormMessage from "metabase/components/form/FormMessage.jsx";
import LogoIcon from "metabase/components/LogoIcon.jsx";
import Settings from "metabase/lib/settings";
import Utils from "metabase/lib/utils";
import LoadingSpinner from "metabase/components/LoadingSpinner.jsx";

import * as authActions from "../auth";
import XHRMock from "xhr-mock";

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

  onSSOButtonClick = e => {
    e.preventDefault();
    return this.getAccessToken();
  };

  getAccessToken = () => {
    const width = 600;
    const height = 400;
    const left = screen.width / 2 - width / 2;
    const right = screen.height / 2 - height / 2;
    const data = {
      client_id: "a87837bd-4715-4753-adc4-c087ad2f32b6",
      scope: "openid",
      response_type: "id_token token",
      state: "M98jds+2DSKL9VXN40",
      nonce: "M98jds+2DSKL9VXN40",
      redirect: "http://hxia:3000/auth/login",
    };
    const authenticationUrl =
      "https://softheon-b2b.login-model.softheon.com/oauth2/connect/authorize";
    // const poppedWindow = window.open(
    //   "",
    //   "",
    //   `toolbar=no, location=no, status=no, scrollbars=no, resizable=no, copyhistory=no, width=${width}, height=${height}, left=${left}, right=${right}`,
    // );

   
    const Oauth = new Promise((resolve, reject)=> {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://softheon-b2b.login-model.softheon.com/oauth2/connect/authorize");
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.onreadystatechange = () => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                let body = xhr.responseText;
                try {
                  body = JSON.parse(body);
                } catch (e) {}
                if (xhr.status >= 200 && xhr.status <= 299) {
                //   if (options.transformResponse) {
                //     body = options.transformResponse(body, { data });
                //   }
                  resolve(body);
                } else {
                  reject({
                    status: xhr.status,
                    data: body,
                  
                  });
                }
                // if (!options.noEvent) {
                //   this.emit(xhr.status, url);
                // }
              }
        }
        xhr.send(JSON.stringify(data));
    });


    Oauth.then(response => {
        console.log(response);
    })
  
        
  
    // poppedWindow.fetch("https://softheon-b2b.login-model.softheon.com/oauth2/Account/Login").then(
    //     (response) => {
    //         console.log("response", response);
    //     }).catch( error => {
    //         console.log("popped window error", error);
    //     })
    // console.log("body", JSON.stringify(data));

    // poppedWindow.fetch("http://hxia:3000/auth/login",
    //  { method: "GET" })
    // .then( response => {
    //     console.log(response);
    //     poppedWindow.location = 'https://softheon-b2b.login-model.softheon.com/oauth2/Account/Login';
    //     this.polling(poppedWindow);
    // }).catch(e => {
    //     console.log(e);
    // });
    //window.location.href = 'https://softheon-b2b.login-model.softheon.com/oauth2/Account/Login';

    // fetch(authenticationUrl, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/x-www-form-urlencoded",
    //   },
    //   credentials: "same-origin",
     
    //   body: JSON.stringify(data),
    // }).then(response => {
    //     console.log("response", response);
    // }).catch(error => {
    //     console.log("error", error)
    // });



    return null;
  };

  polling = window => {
      console.log("window object", window);
    const polling = setInterval(() => {
      if (!window || window.closed || window.closed === undefined) {
        clearInterval(polling);
      }

      const closeWindow = () => {
        clearInterval(polling);
        window.close();
      };

      if (window.location.search) {
        const query = new URLSearchParams(window.location.search);
        console.log(query);
        closeWindow();
      } else {
        closeWindow();
        console.log("window object", window);
      }
    }, 1000);
  };

  componentDidMount() {
    this.validateForm();

    const { loginGoogle, location } = this.props;

    let ssoLoginButton = findDOMNode(this.refs.ssoLoginButton);
    console.log("create ssoLoginButton", ssoLoginButton);

    ssoLoginButton.addEventListener("click", this.onSSOButtonClick);

    // function attachGoogleAuth() {
    //   if gapi isn't loaded yet then wait 100ms and check again. Keep doing this until we're ready
    //   if (!window.gapi) {
    //     window.setTimeout(attachGoogleAuth, 100);
    //     console.log("window gap is not loaded yet.")
    //     return;
    //   }
    //   try {
    //     console.log("window gap loaded.")
    //     window.gapi.load("auth2", () => {
    //       let auth2 = window.gapi.auth2.init({
    //         client_id: "12",
    //         cookiepolicy: "single_host_origin",
    //       });
    //       auth2.attachClickHandler(
    //         ssoLoginButton,
    //         {},
    //         googleUser => googleUser,
    //         error => console.error("There was an error logging in", error),
    //       );
    //     });
    //   } catch (error) {
    //     console.error("Error attaching Google Auth handler: ", error);
    //   }
    // }
    // attachGoogleAuth();
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
    const ldapEnabled = Settings.ldapEnabled();
    const isLoading = !loginError && this.state.isLoading;

    return (
      <div className="full bg-white flex flex-column flex-full md-layout-centered">
        <div className="Login-wrapper wrapper Grid Grid--full md-Grid--1of2 relative z2">
          <div className="Grid-cell flex layout-centered text-brand">
            <LogoIcon className="Logo my4 sm-my0" width={66} height={85} />
          </div>
          <div className="Login-content Grid-cell">
            <form
              className="Form-new bg-white bordered rounded shadowed"
              name="form"
              onSubmit={e => this.formSubmitted(e)}
            >
              <h3 className="Login-header Form-offset">{t`Sign in to Foundry`}</h3>

              {true && (
                <div className="mx4 mb4 py3 border-bottom relative">
                  <SSOLoginButton provider="softheon" ref="ssoLoginButton" />
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
                  title={
                    Settings.ldapEnabled()
                      ? t`Username or email address`
                      : t`Username or email address`
                  }
                  fieldName={"username"}
                  formError={loginError}
                />
                <input
                  className="Form-input Form-offset full py1"
                  name="username"
                  placeholder="youlooknicetoday@email.com"
                  type={
                    /*
                     * if a user has ldap enabled, use a text input to allow for
                     * ldap username && schemes. if not and they're using built
                     * in auth, set the input type to email so we get built in
                     * validation in modern browsers
                     * */
                    ldapEnabled ? "text" : "text"
                  }
                  onChange={e => this.onChange("username", e.target.value)}
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
                  onChange={e => this.onChange("password", e.target.value)}
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

              <div className="Form-actions p4">
                <Button primary={this.state.valid} disabled={!this.state.valid}>
                  {t`Sign in`}
                </Button>
                <Link
                  to={
                    "/auth/forgot_password" +
                    (Utils.validEmail(this.state.credentials.username)
                      ? "?email=" + this.state.credentials.username
                      : "")
                  }
                  className="Grid-cell py2 sm-py0 md-text-center text-centered flex-full link"
                  onClick={e => {
                    window.OSX ? window.OSX.resetPassword() : null;
                  }}
                >{t`Forgot password`}</Link>
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
}
