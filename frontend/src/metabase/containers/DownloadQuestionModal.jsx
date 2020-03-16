import React, { Component } from "react";
import { CSSTransitionGroup } from "react-transition-group";
import { t } from "c-3po";
import moment from "moment";

import ModalContent from "metabase/components/ModalContent.jsx";
import FormField from "metabase/components/form/FormField.jsx";
import Button from "metabase/components/Button.jsx";
import "./DownloadQuestionModal.css";
import { extractQueryParams } from "metabase/lib/urls";

export default class DownloadQuestionModal extends Component {
  constructor(props, context) {
    super(props, context);
    const defaultName =
      this.props.card && this.props.card.name
        ? this.props.card.name + "_" + moment().format("YYYY_MM_DD_THH_mm_SZZ")
        : "New Question";

    this.state = {
      error: null,
      valid: false,
      details: {
        name: defaultName,
      },
    };
  }

  componentDidMount() {
    this.validateForm();
  }

  componentDidUpdate() {
    this.validateForm();
  }

  validateForm() {
    let { details } = this.state;
    let valid = true;
    if (!details.name) {
      valid = false;
    }
    if (this.state.valid != valid) {
      this.setState({ valid });
    }
  }

  onChange(fieldName, fieldValue) {
    this.setState({
      details: {
        ...this.state.details,
        [fieldName]: fieldValue ? fieldValue : null,
      },
    });
  }

  formSubmitted = async e => {
    this.refs.downloadForm.submit();
    this.props.onClose();
  };

  render() {
    const { method, url, params } = this.props;
    const queryParams = params && extractQueryParams(params);
    queryParams.push(["name", this.state.details.name]);
    return (
      <ModalContent
        id="DownloadQuestionModal"
        title={t`Download question`}
        footer={[
          <Button onClick={this.props.onClose}>{t`Cancel`}</Button>,
          <Button
            disabled={!this.state.valid}
            onClick={this.formSubmitted}
          >{t`Download`}</Button>,
        ]}
        onClose={this.props.onClose}
      >
        <form onSubmit={this.formSubmitted} method="" action="">
          <CSSTransitionGroup
            transitionName="DownloadQuestionModalFields"
            transitionEnterTimeout={500}
            transitionLeaveTimeout={500}
          >
            <div
              key="downloadQuestionModalFields"
              className="downloadQuestionModalFields"
            >
              <FormField
                name="name"
                displayName={t`Name`}
                formError={this.state.error}
              >
                <input
                  className="Form-input full"
                  name="name"
                  placeholder={t`What is the name of your file?`}
                  value={this.state.details.name}
                  onChange={e => this.onChange("name", e.target.value)}
                  autoFocus
                />
              </FormField>
            </div>
          </CSSTransitionGroup>
        </form>
        <form method={method} action={url} ref="downloadForm">
          {queryParams.map(([name, value]) => (
            <input type="hidden" name={name} value={value} />
          ))}
        </form>
      </ModalContent>
    );
  }
}
