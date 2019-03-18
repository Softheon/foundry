/* eslint "react/prop-types": "warn" */
import React, { Component } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import { t } from "c-3po";
import Icon from "metabase/components/Icon.jsx";
import colors from "metabase/lib/colors";

export default class NewsletterForm extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = { submitted: false };

    this.styles = {
      container: {
        borderWidth: "2px",
      },

      input: {
        fontSize: "1.1rem",
        color: colors["text-dark"],
        width: "350px",
      },

      label: {
        top: "-12px",
      },
    };
  }

  static propTypes = {
    initialEmail: PropTypes.string.isRequired,
  };

  subscribeUser(e) {
    e.preventDefault();
    this.setState({ submitted: true });
  }

  render() {
    const { initialEmail } = this.props;
    const { submitted } = this.state;

    return (
      <div
        style={this.styles.container}
        className="bordered rounded p4 relative"
      >
        <div
          style={this.styles.label}
          className="absolute text-centered left right"
        >
          <div className="px3 bg-white h5 text-bold text-medium text-uppercase inline-block">
            <Icon className="mr1 float-left" name="mail" size={16} />
            <span
              className="inline-block"
              style={{ marginTop: 1 }}
            >{t`Foundry Newsletter`}</span>
          </div>
        </div>

        <div className="MB-Newsletter sm-float-right">
          <div>
            <div
              style={{ color: colors["text-medium"] }}
              className="text-medium h3 pb3"
            >
              {t`Get infrequent emails about new releases and feature updates.`}
            </div>

            <form onSubmit={this.subscribeUser.bind(this)} noValidate>
              <div>
                {!submitted ? (
                  <div className="">
                    <input
                      ref="email"
                      style={this.styles.input}
                      className="AdminInput bordered rounded h3 inline-block"
                      type="email"
                      defaultValue={initialEmail}
                      placeholder={t`Email address`}
                    />
                    <input
                      className="Button float-right inline-block ml1"
                      type="submit"
                      value={t`Subscribe`}
                      name="subscribe"
                    />
                  </div>
                ) : (
                  <div className="text-success text-centered text-bold h3 p1">
                    <Icon className="mr2" name="check" size={16} />
                    {t`You're subscribed. Thanks for using Foundry!`}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}
