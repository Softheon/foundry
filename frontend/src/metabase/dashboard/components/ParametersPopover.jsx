/* @flow */
import React, { Component } from "react";
import { t } from "c-3po";
//import { PARAMETER_SECTIONS } from "metabase/meta/Dashboard";

import type { Parameter, ParameterOption } from "metabase/meta/types/Parameter";

import _ from "underscore";

import type { ParameterSection } from "metabase/meta/Dashboard";
import cx from "classnames";

export default class ParametersPopover extends Component {
  props: {
    onAddParameter: (option: ParameterOption) => Promise<Parameter>,
    onClose: () => void,
  };
  state: {
    section?: string,
  };

  constructor(props: any, context: any) {
    super(props, context);
    this.state = {};
  }

  render() {
    const { section } = this.state;
    const { onClose, onAddParameter, parameterSections  } = this.props;
    if (section == null) {
      return (
        <ParameterOptionsSectionsPane
          sections={parameterSections}
          onSelectSection={selectedSection => {
            let parameterSection = _.findWhere(parameterSections, {
              id: selectedSection.id,
            });
            if (parameterSection && parameterSection.options.length === 1) {
              onAddParameter(parameterSection.options[0]);
              onClose();
            } else {
              this.setState({ section: selectedSection.id });
            }
          }}
        />
      );
    } else {
      let parameterSection = _.findWhere(parameterSections, { id: section });
      let isCrossFilterSection = parameterSection.id === "crossfilter";
      return (
        <ParameterOptionsPane
          options={parameterSection && parameterSection.options}
          onSelectOption={option => {
            onAddParameter(option);
            onClose();
          }}
          isCrossFilterSection= {isCrossFilterSection}
        />
      );
    }
  }
}

export const ParameterOptionsSection = ({
  section,
  onClick,
}: {
  section: ParameterSection,
  onClick: () => any,
}) =>{
  const isCrossfilterSection = section.id === "crossfilter";
  const hasCrossfilterOptions = isCrossfilterSection && section.options.length > 1;
  let onClickHandler = null;
  if (!isCrossfilterSection || (isCrossfilterSection && hasCrossfilterOptions)) {
    onClickHandler = onClick;
  } else {
    onClickHandler = null;
  }
  return  (
    <li onClick={onClickHandler} className={cx("p1 px2", {
      "cursor-pointer": onClickHandler,
      "brand-hover": onClickHandler,
      "disabled": !onClickHandler,
      "no-decoration": !onClickHandler,
    })} >
      <div className="text-brand text-bold">{section.name}</div>
      <div>{section.description}</div>
    </li>
  )
};

export const ParameterOptionsSectionsPane = ({
  sections,
  onSelectSection,
}: {
  sections: Array<ParameterSection>,
  onSelectSection: ParameterSection => any,
}) => (
  <div className="pb2">
    <h3 className="p2">{t`What do you want to filter?`}</h3>
    <ul>
      {sections.map(section => (
        <ParameterOptionsSection
          section={section}
          onClick={() => onSelectSection(section)}
        />
      ))}
    </ul>
  </div>
);

export const ParameterOptionItem = ({
  option,
  onClick,
}: {
  option: ParameterOption,
  onClick: () => any,
}) => (
  <li onClick={onClick} className="p1 px2 cursor-pointer brand-hover">
    <div className="text-brand text-bold">{option.menuName || option.name}</div>
    <div>{option.description}</div>
  </li>
);

export const ParameterOptionsPane = ({
  options,
  onSelectOption,
  isCrossFilterSection,
}: {
  options: ?Array<ParameterOption>,
  onSelectOption: ParameterOption => any,
  isCrossFilterSection: ?boolean,
}) => (
  <div className="pb2">
    { !isCrossFilterSection 
      ? <h3 className="p2">{t`What kind of filter?`}</h3>
    : <h3 className="p2">{t`What is the data source?`}</h3> }

    
    <ul>
      {options &&
        options.map(option => (
          <ParameterOptionItem
            option={option}
            onClick={() => onSelectOption(option)}
          />
        ))}
    </ul>
  </div>
);
