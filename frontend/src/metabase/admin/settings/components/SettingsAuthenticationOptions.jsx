import React, { Component } from "react";
import { Link } from "react-router";
import { t } from "c-3po";

class SettingsAuthenticationOptions extends Component {
  constructor(props, context) {
    super(props, context);
  }

  render() {
    return (
      <ul className="text-measure">
        <li>
          <div className="bordered rounded shadowed bg-white p4">
            <div className="flex align-center">
              <h2>{t`Sign in With Identity Service`}</h2>
              {
                this.props.settingValues && this.props.settingValues["ids-auth-client-id"] &&
                (<div className="ml-auto flex align-center text-uppercase text-success">
                  <div className="bg-success circular mr1" style={{ "width": "10px", "height": "10px" }}></div>
                  {t`active`}
                </div>)
              }
            </div>
            <p>
              {t`Allows users authenticated and authorized by Identity Service to login with a Foundry account that matches their email addresses in addition to their Foundry username and password`}
            </p>
            <Link className="Button" to="admin/settings/authentication/ids">{t`Configure`}</Link>
          </div>
        </li>
        {/* <li>
          <div className="bordered rounded shadowed bg-white p4">
            <h2>{t`Sign in with Google`}</h2>
            <p
            >{t`Allows users with existing Foundry accounts to login with a Google account that matches their email address in addition to their Foundry username and password.`}</p>
            <Link
              className="Button"
              to="/admin/settings/authentication/google"
            >{t`Configure`}</Link>
          </div>
        </li>

        <li className="mt2">
          <div className="bordered rounded shadowed bg-white p4">
            <h2>{t`LDAP`}</h2>
            <p
            >{t`Allows users within your LDAP directory to log in to Foundry with their LDAP credentials, and allows automatic mapping of LDAP groups to Foundry groups.`}</p>
            <Link
              className="Button"
              to="/admin/settings/authentication/ldap"
            >{t`Configure`}</Link>
          </div>
        </li> */}
      </ul>
    );
  }
}

export default SettingsAuthenticationOptions;
