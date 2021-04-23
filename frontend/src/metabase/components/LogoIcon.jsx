import React, { Component } from "react";
import PropTypes from "prop-types";
import cx from "classnames";

export default class LogoIcon extends Component {
  static defaultProps = {
    size: 32,
  };

  static propTypes = {
    size: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    dark: PropTypes.bool,
  };

  render() {
    let { dark, height, width, size } = this.props;
    return (
      <img className={cx("Icon", { "text-brand": !dark}, {"text-white": dark})} style = {{width: "500px", "padding-bottom" : "25px"}}
      src="app/assets/img/Softheon_Logo_Color.png"
      />
    );
  }
}
