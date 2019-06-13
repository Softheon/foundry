import React, { Component } from "react";
import { t } from "c-3po";
import CheckBox from "metabase/components/CheckBox.jsx";
import ListSearchField from "metabase/components/ListSearchField.jsx";
import { capitalize } from "metabase/lib/formatting";
import { createMultiwordSearchRegex } from "metabase/lib/string";

export default class CrossfilterDimensionPicker extends Component {

  constructor(props) {
    super(props);
    this.state = {
      searchText: "",
      searchRegex: null,
    };
  }

  updateSearchText = (value: string) => {
    let regex = null;

    if (value) {
      regex = createMultiwordSearchRegex(value);
    }

    this.setState({
      searchText: value,
      searchRegex: regex,
    });
  };

  selectValue(key, selected) {
    let values;
    if (this.props.multi) {
      values = this.props.values.slice().filter(v => v != null);
    } else {
      values = [];
    }
    if (selected) {
      values.push(key);
    } else {
      values = values.filter(v => v !== key);
    }
    this.props.onValuesChange(values);
  }

  nameForOption(option) {
    if (option.name === "") {
      return t`Empty`;
    } else if (typeof option.name === "string") {
      return option.name;
    } else {
      return capitalize(String(option.name));
    }
  }

  render() {
    let { values, options, placeholder } = this.props;
    let checked = new Set(values);
    let validOptions = [];
    let regex = this.state.searchRegex;

    if (regex) {
      for (const option of options) {
        if (regex.test(option.key) || regex.test(option.name)) {
          validOptions.push(option);
        }
      }
    } else {
      validOptions = options.slice();
    }
    return (
      <div>
        {validOptions.length <= 10 && !regex ? null : (
          <div className="px1 pt1">
            <ListSearchField
              onChange={this.updateSearchText}
              searchText={this.state.searchText}
              placeholder={t`Find a value`}
              autoFocus={true}
            />
          </div>
        )}
        <div
          className="px1 pt1"
          style={{ maxHeight: "400px", overflowY: "scroll" }}
        >
          {placeholder ? <h5>{placeholder}</h5> : null}
          <ul>
            {validOptions.map((option, index) => (
              <li key={index}>
                <label
                  className="flex align-center cursor-pointer p1"
                  onClick={() =>
                    this.selectValue(option.key, !checked.has(option.key))
                  }
                >
                  <CheckBox checked={checked.has(option.key)} color="purple" />
                  <h4 className="ml1">{this.nameForOption(option)}</h4>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
}
