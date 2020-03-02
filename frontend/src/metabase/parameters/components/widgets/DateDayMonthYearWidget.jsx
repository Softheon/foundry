import React, { Component } from "react";
import Calendar from "metabase/components/Calendar.jsx";
import moment from "moment";
import _ from "underscore";
import cx from "classnames";

export default class DateMonthYearWidget extends Component {
  constructor(props, context) {
    super(props, context);
  }

  static propTypes = {};
  static defaultProps = {};

  static format = value => {
    const m = moment(value, "YYYY-MM-DD");
    return m.isValid() ? m.format("MMMM D, YYYY") : "";
  };

  onClose = selected => {
    const { onClose, setValue } = this.props;
    if (this.props.value !== selected) {
      setValue(selected);
    }
    onClose();
  };

  render() {
    const { value } = this.props;
    const initialDate = moment(value);
    if (!initialDate.isValid) {
      return null;
    }
    return (
      <div className="p1">
        <Calendar
          initial={value ? moment(value) : null}
          selected={value ? moment(value) : null}
          onChange={ (_, selected) => {
            this.onClose(selected);
          }}
        />
      </div>
    );
  }
}

const Month = ({ month, selected, onClick }) => (
  <li
    className={cx("cursor-pointer px3 py1 text-bold text-brand-hover", {
      "text-brand": selected,
    })}
    onClick={onClick}
  >
    {moment()
      .month(month)
      .format("MMMM")}
  </li>
);
