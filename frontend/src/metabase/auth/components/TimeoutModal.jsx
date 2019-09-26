import React from "react";
import _ from "underscore";
import { connect } from "react-redux";
import { t } from "c-3po";

import Modal from "metabase/components/Modal.jsx";
import { logout, idleSessionTimeout } from "metabase/auth/auth.js";
import Icon from "metabase/components/Icon.jsx";

const defaultEvents = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];
const mapStateToProps = null;

const mapDispatchToProps = {
  logout,
  idleSessionTimeout,
};

@connect(mapStateToProps, mapDispatchToProps)
export default class TimeoutModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };
    this.modalTimeoutId = null;
    this.idleTimeoutId = null;
    this.debouncedOnUserActivity = _.debounce(this.onUserActivity, 1000);
   
  }

  resetIdleTime = () => {
    clearTimeout(this.idleTimeoutId);
    this.idleTimeoutId = setTimeout(() => {
      this.props.idleSessionTimeout();
    }, this.props.idleTimeout * 1000 * 60);
  };

  onUserActivity = () => {
    this.resetIdleTime();
    clearTimeout(this.modalTimeoutId);
    this.modalTimeoutId = setTimeout(() => {
      this.setState({ open: true });
    }, this.props.modelTimeout * 1000 * 60);
  };

  registerUserActivityListeners = () => {
    clearTimeout(this.modalTimeoutId);
    defaultEvents.forEach(event => {
      window.addEventListener(event, this.debouncedOnUserActivity);
    });
  };

  unregisterUserActivityListeners = () => {
    clearTimeout(this.modalTimeoutId);
    defaultEvents.forEach(event => {
      window.removeEventListener(event, this.debouncedOnUserActivity);
    });
  };

  componentDidMount() {
    this.registerUserActivityListeners();
    this.resetIdleTime();
  }

  componentDidUpdate() {
    if (this.state.open) {
      this.unregisterUserActivityListeners();
    }
  }
  componentWillUnmount() {
    clearTimeout(this.idleTimeoutId);
    this.unregisterUserActivityListeners();
  }

  onClose = () => {
    this.registerUserActivityListeners();
    this.onUserActivity();
    this.resetIdleTime();
    this.setState({
      open: false,
    });
  };

  render() {
    if (this.state.open) {
      return (
        <Modal full={false} isOpen={true}>
          <div className="TutorialModalContent p2">
            <div className="px4">
              <div className="text-centered">
                <h2>{t`Your Session is about to end`}</h2>
                <p className="my2 text-medium">{t`You have been inactive for 30 minutes, if you do not have any activity in the next 30 minutes you will be logged out.`}</p>
                <button
                  className="Button Button--primary z6"
                  onClick={this.onClose}
                >{t`Stay signed in`}</button>
              </div>
            </div>
          </div>
        </Modal>
      );
    }
    return null;
  }
}
