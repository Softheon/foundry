import React, { Component } from "react";
import { t } from "c-3po";
import LogoIcon from "metabase/components/LogoIcon.jsx";
import BackToLogin from "./BackToLogin.jsx";
import { connect } from "react-redux";

const mapStateToProps = (state, props) => {
  return {
    loginError: state.auth && state.auth.loginError,
  };
};

@connect(mapStateToProps, null)
export default class IamEmailNotVerified extends Component {
  constructor(props, context) {
    super(props, context);
  }
  render() {
    return (
      <div className="full-height bg-white flex flex-column flex-full md-layout-centered">
        <div className="wrapper">
          <div className="Login-wrapper Grid  Grid--full md-Grid--1of2">
            <div className="Grid-cell flex layout-centered text-brand">
              <LogoIcon className="Logo my4 sm-my0" width={66} height={85} />
            </div>
            <div className="Grid-cell text-centered bordered rounded shadowed p4">
              {/* <h3 className="mt4 mb2">{t`${e}`}</h3> */}
              <p
                className="mb4 ml-auto mr-auto text-error"
                style={{ maxWidth: 360 }}
              >
                {t`Email is not verified. You will need to verify your email before you can use Iam to log in.`}
              </p>
              <BackToLogin />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
