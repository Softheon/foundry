import React from "react";
import _ from "underscore";
import { connect } from "react-redux";
import { t } from "c-3po";
import moment from "moment";
import Modal from "metabase/components/Modal.jsx";
import {
  logout,
  idleSessionTimeout,
  sessionTimeout,
} from "metabase/auth/auth.js";

import {
  getQuestion,
  getQuery,
  getIsDirty,
  getIsNew,
  getCard,
} from "metabase/query_builder/selectors.js"

import {
  getUser,
  getUserPersonalCollectionId,
} from "metabase/selectors/user";

import {
  apiCreateQuestion
} from "metabase/query_builder/actions.js"

const defaultEvents = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];
const mapStateToProps = (state, props) => {
  return {
    question: getQuestion(state),
    query: getQuery(state),
    isNew: getIsNew(state),
    isDirty: getIsDirty(state),
    currentCard: getCard(state),
    currentUserPersonalCollectionId: getUserPersonalCollectionId(state),
  }
};

const mapDispatchToProps = {
  logout,
  idleSessionTimeout,
  sessionTimeout,
  apiCreateQuestion,
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
      try {
        this.saveUnsavedCard();
        this.props.idleSessionTimeout();
        this.props.sessionTimeout();
      } catch (e) {
        this.props.sessionTimeout();
      }
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

  saveUnsavedCard = async () => {
    const { question, apiCreateQuestion } = this.props;
    const { isNew, isDirty, currentCard, currentUserPersonalCollectionId } = this.props;
    if (currentCard) {
      if (isNew || isDirty) {
        currentCard.name = "Unsaved_Report" + moment().format();
        currentCard.collection_id = currentUserPersonalCollectionId;
        const questionWithUpdatedCard = question.setCard(currentCard);
        await apiCreateQuestion(questionWithUpdatedCard);
      }
    }
  }

  render() {
    const { counter } = this.state;
    if (counter >= 0 && counter <= TIMEOUT_MODAL_COUNTER) {
      if (counter == 0) {
        return (
          <Modal full={false} isOpen={true}>
            <div className="TutorialModalContent p2">
              <div className="px4">
                <div className="text-centered">
                  <h2>{t`Your Session expired`}</h2>
                </div>
              </div>
            </div>
          </Modal>
        );
      }
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
