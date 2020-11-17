import React from "react";
import _ from "underscore";
import { connect } from "react-redux";
import { t } from "c-3po";
import moment from "moment";
import Modal from "metabase/components/Modal.jsx";
import IdleTimer from "react-idle-timer";
import Button from "metabase/components/Button.jsx";

import {
  logout,
  idleSessionTimeout,
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
  apiCreateQuestion,
};

@connect(mapStateToProps, mapDispatchToProps)
export default class TimeoutModal extends React.Component {
  constructor(props) {
    super(props);
    this.idleTimer = null;
    this.state = {
      timeout: false
    };
  }


  componentDidMount() {
    this.renewActivitySession();
  }

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

  handleOnAction = event => {
    if (this.isUserInActive() || this.activitySessionExpired()) {
      this.timeoutUser();
    }
    else {
      this.renewActivitySession();
    }
  }

  handleOnIdle = event => {
    if (this.activitySessionExpired()) {
      this.timeoutUser();
    }
  }

  isUserInActive = () => {
    return window.localStorage.inactive ? true : false;
  }

  activitySessionExpired = () => {
    const myStorage = window.localStorage;
    const idle_end_time = myStorage.idle_end_time;
    if (!idle_end_time) {
      return true;
    }
    return moment().isAfter(moment(idle_end_time));
  }

  timeoutUser = () => {
    console.log("timing out user");
    window.localStorage.inactive = 0;
    this.setState({ timeout: true });
  }

  renewActivitySession = () => {
    window.localStorage.idle_end_time = moment().add(30, 'm').format();
    this.setState({ timeout: false });
  }

  onSessionTimeout = event => {
    if (this.isUserInActive()) {
      this.saveUnsavedCard();
      this.props.idleSessionTimeout();
    }
    window.location.reload();   
  }

  render() {
    const { timeout } = this.state;
    if (timeout) {
      return (
        <Modal
          small
          form
          title={t`Session timeout`}
          footer={[
            <Button primary onClick={this.onSessionTimeout}>{t`Okay`}</Button>,
          ]}
          onClose={this.onSessionTimeout}
        >
          <p className="text-paragraph pb2">{t`Your Session has timeout out. Please login again.`}</p>
        </Modal>
      );
    } else {
      return (
        <IdleTimer
          ref={ref => { this.idleTimer = ref }}
          timeout={1000 * 60 * 25}
          onAction={this.handleOnAction}
          onIdle={this.handleOnIdle}
          onActive={this.hanldeOnActive}
          debounce={250}
        />
      );
    }
  }
}
