import React from "react";
import _ from "underscore";
import { connect } from "react-redux";
import { t } from "c-3po";

import Modal from "metabase/components/Modal.jsx";
import { logout, idleSessionTimeout } from "metabase/auth/auth.js";

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

const TIMEOUT_MODAL_COUNTER = 5;
const SESSION_TIMEOUT = 60;

@connect(mapStateToProps, mapDispatchToProps)
export default class TimeoutModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      counter: SESSION_TIMEOUT,
    };
    this.timer = null;
    this.debouncedOnUserActivity = _.throttle(this.onUserActivity, 1000);
  }

  onUserActivity = () => {
    this.setState(
      {
        counter: SESSION_TIMEOUT,
      },
      this.ResetTimer,
    );
  };

  registerUserActivityListeners = () => {
    defaultEvents.forEach(event => {
      window.addEventListener(event, this.debouncedOnUserActivity);
    });
  };

  unregisterUserActivityListeners = () => {
    defaultEvents.forEach(event => {
      window.removeEventListener(event, this.debouncedOnUserActivity);
    });
  };

  ResetTimer = () => {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.setState((state, props) => ({
        counter: state.counter - 1,
      }));
    }, 1000 * 60);
  };

  componentDidMount() {
    this.unregisterUserActivityListeners();
    this.registerUserActivityListeners();
    this.ResetTimer();
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    this.unregisterUserActivityListeners();
  }

  componentDidUpdate() {
    if (this.state.counter === TIMEOUT_MODAL_COUNTER) {
      this.unregisterUserActivityListeners();
    } else if (this.state.counter <= 0) {
      clearInterval(this.timer);
      this.props.idleSessionTimeout();
    }
  }

  onClose = () => {
    this.setState(
      {
        counter: SESSION_TIMEOUT,
      },
      () => {
        this.registerUserActivityListeners();
        this.ResetTimer();
      },
    );
  };

  render() {
    if (
      this.state.counter >= 0 &&
      this.state.counter <= TIMEOUT_MODAL_COUNTER
    ) {
      return (
        <Modal full={false} isOpen={true}>
          <div className="TutorialModalContent p2">
            <div className="px4">
              <div className="text-centered">
                <h2>{t`Your Session is about to end`}</h2>
                <p className="my2 text-medium">{t`If you do not have any activity in the next ${
                  this.state.counter
                } ${
                  this.state.counter > 1 ? "minutes" : "minute"
                }, you will be logged out.`}</p>
                {this.state.counter != 0 && (
                  <button
                    className="Button Button--primary z6"
                    onClick={this.onClose}
                  >{t`Stay signed in`}</button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      );
    }
    return null;
  }
}
