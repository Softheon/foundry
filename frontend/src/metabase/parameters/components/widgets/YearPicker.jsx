import React from "react";

import Select from "metabase/components/Select.jsx";
import _ from "underscore";

const NUMBER_OF_FUTURE_YEARS = 10;
const YEARS = _.range(new Date().getFullYear() + NUMBER_OF_FUTURE_YEARS, 1900, -1);

const YearPicker = ({ value, onChange }) => (
  <Select
    className="borderless"
    value={value}
    options={YEARS}
    optionNameFn={option => option}
    optionValueFn={option => option}
    onChange={onChange}
  />
);

export default YearPicker;
