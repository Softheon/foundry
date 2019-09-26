import React, { Component } from "react";
import PropTypes from "prop-types";
import { Box, Flex } from "grid-styled";

import colors from "metabase/lib/colors";
import { extractQueryParams } from "metabase/lib/urls";

import Icon from "metabase/components/Icon";
import Text from "metabase/components/Text";
import ModalWithTrigger from "./ModalWithTrigger";
import DownloadQuestionModal from "../containers/DownloadQuestionModal";

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

const DownloadButton = ({
  children,
  method,
  url,
  params,
  extensions,
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
        }}
        {...props}
      >
        <Icon name={children} size={32} mr={1} color={colorForType(children)} />
        <Text className="text-bold">.{children}</Text>
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
              onClick={e => {}}
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
