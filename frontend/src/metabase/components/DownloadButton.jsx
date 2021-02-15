import React, { Component } from "react";
import PropTypes from "prop-types";
import { Box, Flex } from "grid-styled";

import colors from "metabase/lib/colors";
import { extractQueryParams } from "metabase/lib/urls";

import Icon from "metabase/components/Icon";
import Text from "metabase/components/Text";
import ModalWithTrigger from "./ModalWithTrigger";
import DownloadQuestionModal from "../containers/DownloadQuestionModal";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

function colorForType(type) {
  switch (type) {
    case "csv":
      return colors["accent7"];
    case "xlsx":
      return colors["accent1"];
    case "json":
      return colors["bg-dark"];
    default:
      return colors["brand"];
  }
}

function downloadAsPdf (card) {
  console.log("card to be download", card);
  let viz = document.getElementsByClassName('CardVisualization')[0];
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
    pdf.save(`${card && card.name || "new-report"}.pdf`);
  });
}

const DownloadButton = ({
  children,
  method,
  url,
  params,
  extensions,
  card,
  ...props
}) => (
    <Box>
      <form method={method} action={url}>
        {params && extractQueryParams(params).map(getInput)}
        <Flex
          is="button"
          className="text-white-hover bg-brand-hover rounded cursor-pointer full hover-parent hover--inherit"
          align="center"
          px={1}
          onClick={e => {
            if (window.OSX) {
              // prevent form from being submitted normally
              e.preventDefault();
              // download using the API provided by the OS X app
              window.OSX.download(method, url, params, extensions);
            }
            if (children === "pdf") {
              e.preventDefault();
              downloadAsPdf(card);
            }
          }}
          {...props}
        >
          <Icon name={children} size={32} mr={1} color={colorForType(children)} />
          <Text className="text-bold">{children}</Text>
        </Flex>
      </form>
    </Box>
  );

export class DownloadModalButton extends Component {
  constructor(props, context) {
    super(props, context);
  }

  render() {
    const { children } = this.props;
    return (
      <ModalWithTrigger
        ref="downloadQuestionModal"
        triggerClasses="h4 text-brand-hover text-uppercase"
        triggerElement={
          <Box>
            <Flex
              is="button"
              className="text-white-hover bg-brand-hover rounded cursor-pointer full hover-parent hover--inherit"
              align="center"
              px={1}
              onClick={e => { }}
            >
              <Icon
                name={children}
                size={32}
                mr={1}
                color={colorForType(children)}
              />
              <Text className="text-bold">.{children}</Text>
            </Flex>
          </Box>
        }
      >
        <DownloadQuestionModal
          {...this.props}
          onClose={() => this.refs.downloadQuestionModal.toggle()}
        />
      </ModalWithTrigger>
    );
  }
}

const getInput = ([name, value]) => (
  <input type="hidden" name={name} value={value} />
);

DownloadButton.propTypes = {
  url: PropTypes.string.isRequired,
  method: PropTypes.string,
  params: PropTypes.object,
  extensions: PropTypes.array,
};

DownloadButton.defaultProps = {
  method: "POST",
  params: {},
  extensions: [],
};

DownloadModalButton.defaultProps = {
  method: "POST",
  params: {},
  extensions: [],
}
export default DownloadButton;
