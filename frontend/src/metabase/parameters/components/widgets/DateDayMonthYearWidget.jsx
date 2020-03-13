import React, { Component } from "react";
import Calendar from "metabase/components/Calendar.jsx";
import moment from "moment";
import _ from "underscore";
import cx from "classnames";
import DateMonthYearWidget from "./DateMonthYearWidget.jsx";

export default class DateDayMonthYearWidget extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      showCalendar: true,
    };
  }

  static propTypes = {};
  static defaultProps = {};

  static format = value => {
    const m = moment(value, "YYYY-MM-DD");
    return m.isValid() ? m.format("MMMM D, YYYY") : "";
  };

  onClose = selected => {
    const { onClose, setValue } = this.props;
    setValue(selected);
    onClose();
  };

  render() {
    const { value, setValue } = this.props;
    const initialDate = moment(this.props.value);
    if (!initialDate.isValid) {
      return null;
    }
    let CalendarDateSelector = (
      <Calendar
        initial={value ? moment(value) : null}
        selected={value ? moment(value) : null}
        onChange={(clicked, selected) => {
          this.onClose(clicked);
        }}
        onHeaderClick={() => {
          this.setState({
            showCalendar: false,
          });
        }}
      />
    );
    let dateMonthYearWidget = (
      <DateMonthYearWidget
        initial={value ? moment(value) : null}
        setValue={value => {
          setValue(moment(value, "YYYY-MM-DD").format("YYYY-MM-DD"));
        }}
        onClose={() => {
          this.setState({
            showCalendar: true,
          });
        }}
      />
    );

    const { showCalendar } = this.state;
    return (
      <div className="p1">
        {showCalendar ? CalendarDateSelector : dateMonthYearWidget}
      </div>
    );
  }
}
