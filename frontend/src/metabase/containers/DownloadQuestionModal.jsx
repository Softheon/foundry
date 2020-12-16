import React, { Component } from "react";
import { CSSTransitionGroup } from "react-transition-group";
import { t } from "c-3po";
import moment from "moment";

import ModalContent from "metabase/components/ModalContent.jsx";
import FormField from "metabase/components/form/FormField.jsx";
import Button from "metabase/components/Button.jsx";
import "./DownloadQuestionModal.css";
import { extractQueryParams } from "metabase/lib/urls";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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

  formSubmitted = e => {

    const { name } = this.state.details;
    const { children } = this.props;
    const cardName = this.props.card.name;

    if (children === 'pdf') {
      let viz = document.getElementsByClassName('CardVisualization')[0];
      const clientRect = viz.getBoundingClientRect();
      const { height, width } = clientRect;
      const canvasOptions = {
        // windowWidth: width,
        // windowHeight: height
      }
      html2canvas(viz, canvasOptions).then(canvas => {
        let pdf = new jsPDF({
          orientation: 'l',
          //  unit: 'px',
          // format: [width, height],
          format: "a4"
        });

        const pageHeight = pdf.internal.pageSize.height || pdf.internal.pageSize.getHeight();
        const pageWidth = pdf.internal.pageSize.width || pdf.internal.pageSize.getWidth();
        const widthRatio = pageWidth / canvas.width;
        const heightRatio = pageHeight / canvas.height;
        const ratio = widthRatio > heightRatio ? heightRatio : widthRatio;

        const canvasWidth = canvas.width * ratio;
        const canvasHeight = canvas.height * ratio;

        const marginX = (pageWidth - canvasWidth) / 2;
        const marginY = (pageHeight - canvasHeight) / 2;
        const img = canvas.toDataURL('image/png');
        pdf.addImage(img, 'JPEG', marginX, marginY, canvasWidth, canvasHeight);
        // pdf.text((cardName || ""), pageWidth / 2, pageHeight + 50, 'center');
        pdf.save(`${name}.pdf`);
      });
    }
    else {
      this.refs.downloadForm.submit();
    }

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
        <form
          key="hidden"
          method={method} action={url} ref="downloadForm">
          {queryParams.map(([name, value]) => (
            <input type="hidden" name={name} value={value} />
          ))}
        </form>

      </ModalContent>
    );
  }
}
