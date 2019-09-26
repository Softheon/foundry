import React, { Component } from "react";

import YearPicker from "./YearPicker.jsx";
import Calendar from "metabase/components/Calendar.jsx";

import moment from "moment";
import _ from "underscore";
import cx from "classnames";

export default class DateMonthYearWidget extends Component {
  constructor(props, context) {
    super(props, context);

    let initial = moment(this.props.value, "YYYY-MM-DD");
    if (initial.isValid()) {
      this.state = {
        day: initial.day(),
        month: initial.month(),
        year: initial.year(),
        selectedDate: initial,
        showCalendar: true,
      };
    } else {
      const now = moment();
      this.state = {
        day: now.day(),
        month: now.month(),
        year: now.year(),
        selectedDate: now,
        showCalendar: true,
      };
    }
  }

  static propTypes = {};
  static defaultProps = {};

  static format = value => {
    const m = moment(value, "YYYY-MM-DD");
    return m.isValid() ? m.format("MMMM D, YYYY") : "";
  };

  componentWillUnmount() {
    const { day, month, year, selectedDate } = this.state;
    if (month != null && year != null && day != null) {
      let value = moment(selectedDate)
        .format("YYYY-MM-DD");
      if (this.props.value !== value) {
        this.props.setValue(value);
      }
    }
  }

  render() {
    const { onClose } = this.props;
    const { day, month, year, showCalendar } = this.state;
    let dateSelector = null;
    if (showCalendar) {
      const initialDate = moment()
        .year(year)
        .month(month)
        .day(day);
      dateSelector = (
        <Calendar
          initial={initialDate}
          selected={initialDate}
          selectedEnd={initialDate}
          onChange={date => {
            const momentDate = moment(date);
            console.log("xia: clicked calendar date", momentDate);
            this.setState(
              {
                year: momentDate.year(),
                month: momentDate.month(),
                day: momentDate.day(),
                selectedDate: momentDate,
              },
              onClose,
            );
          }}
          onHeaderClick={date =>
            this.setState({
              showCalendar: false,
            })
          }
          isDual={false}
          isRangePicker={false}
          enablePrevAndNextMonthSelection={false}
        />
      );
    } else {
      dateSelector = (
        <div>
          <div className="flex flex-column align-center px1">
            <YearPicker
              value={year}
              onChange={year => this.setState({ year: year })}
            />
          </div>
          <div className="flex">
            <ol className="flex flex-column">
              {_.range(0, 6).map(m => (
                <Month
                  key={m}
                  month={m}
                  selected={m === month}
                  onClick={() =>
                    this.setState({ month: m, showCalendar: true })
                  }
                />
              ))}
            </ol>
            <ol className="flex flex-column">
              {_.range(6, 12).map(m => (
                <Month
                  key={m}
                  month={m}
                  selected={m === month}
                  onClick={() =>
                    this.setState({ month: m, showCalendar: true })
                  }
                />
              ))}
            </ol>
          </div>
        </div>
      );
    }
    return <div className="p1">{dateSelector}</div>;
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
