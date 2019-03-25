import React, { Component } from "react";
import PropTypes from "prop-types";
import Autosuggest from "react-autosuggest";
import cx from "classnames";
import pure from "recompose/pure";
import _ from "underscore";
import styled from "styled-components";
import colors from "metabase/lib/colors";
import { space, width } from "styled-system";
import OnClickOutsideWrapper from "metabase/components/OnClickOutsideWrapper";
import color from "color";
import Icon, { IconWrapper } from "metabase/components/Icon";
import { t } from "c-3po";
import { Flex } from "grid-styled";
import IsolatedScroll from "react-isolated-scroll";
import EntityItem from "metabase/components/EntityItem";
import theme from "./theme.css";
import * as Urls from "metabase/lib/urls";
import { SearchApi } from "metabase/services";

import {
  KEYCODE_FORWARD_SLASH,
  KEYCODE_ENTER,
  KEYCODE_ESCAPE,
} from "metabase/lib/keyboard";

function autocompleteResults(q) {
  let apiCall = SearchApi.search({
      q: q
  });
  return apiCall;
}

const normalizeSuggestions = suggestions => {
  const suggestionCategories = new Map();
  for (let suggestion of suggestions) {
    if (!suggestionCategories.has(suggestion.model)) {
      suggestionCategories.set(suggestion.model, []);
    }
    const value = suggestionCategories.get(suggestion.model);
    value.push(suggestion);
  }
  const normalizedSuggestions = [];
  suggestionCategories.forEach((value, key, map) => {
    let updatedKey = key;
    if(key === "segment"){
        return;
    }
    if (key === "card") {
      updatedKey = "question";
    }
    normalizedSuggestions.push({
      model: updatedKey,
      suggestions: value,
    });
  });
  return normalizedSuggestions;
};

const renderSectionTitle = section => {
  const { model } = section;
  return (
    <div className="text-uppercase text-medium text-small text-bold my1">
      {`${model}`}
    </div>
  );
};

const renderSuggestion = (suggestion, { query, isHighlighted }) => {
  return <div>{suggestion.name}</div>;
};

const renderSuggestionsContainer = ({ containerProps, children, query }) => {
  const { ref, ...restContainerProps } = containerProps;
  const callRef = isolatedScroll => {
    if (isolatedScroll !== null) {
      ref(isolatedScroll.component);
    }
  };
  return (
    <IsolatedScroll ref={callRef} {...restContainerProps}>
      {children}
    </IsolatedScroll>
  );
};

const shouldRenderSuggestions = value => {
  return value.trim().length > 0;
};

const getSectionSuggestions = section => section.suggestions;


export default class AutoSuggestSearchBar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: "",
      suggestions: [],
      selected: false,
      active: false,
    };
    this.loadSuggestionThrottled = _.throttle(this.loadSuggestion, 500);
    this.loadSuggestionDebounced = _.debounce(this.loadSuggestion, 800);
  }

  active = () => this.setState({ active: true });

  inactive = () => this.setState({ active: false });

  loadSuggestion = async value => {
      try {
        let results = await autocompleteResults(value);
        this.setState({
            suggestions: normalizeSuggestions(results),
        })
      } catch (error) {
          console.log("error getting suggestion results", error);
          this.setState({
              suggestions: []
          })
      }
  }

  onSuggestionsFetchRequested = ({ value, reason }) => {
    if (reason === "input-changed") {
      if (value && (value.length < 5 || value.endsWith(" "))) {
        this.loadSuggestionThrottled(value);
      } else {
        this.loadSuggestionDebounced(value);
      }
    }
  };

  onChange = (event, { newValue, method }) => {
    this.setState({
      value: newValue,
    });
  };

  onSuggestionSelected = (event, { suggestion, suggestionIndex }) => {
    this.props.onChangeLocation({
      pathname: "search",
      query: { q: suggestion.name },
    });
    this.setState({
      selected: true,
    });
  };

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
      selected: false,
    });
  };

  getSuggestionValue = suggestion => {
    return suggestion.name;
  };

  renderInputComponent = inputProps => {
    const { active } = this.state;
    return (
      <SearchBar
        inputProps={inputProps}
        onChangeLocation={this.props.onChangeLocation}
        setActive={this.active}
        setInactive={this.inactive}
        active={active}
      />
    );
  };

  render() {
    const { value, suggestions, selected } = this.state;
    const inputProps = {
      value,
      onChange: this.onChange,
      selected,
    };

    return (
      <Autosuggest
        suggestions={suggestions}
        onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
        onSuggestionsClearRequested={this.onSuggestionsClearRequested}
        getSuggestionValue={this.getSuggestionValue}
        renderSuggestion={renderSuggestion}
        inputProps={inputProps}
        onSuggestionSelected={this.onSuggestionSelected}
        shouldRenderSuggestions={shouldRenderSuggestions}
        renderInputComponent={this.renderInputComponent}
        renderSuggestionsContainer={renderSuggestionsContainer}
        renderSectionTitle={renderSectionTitle}
        multiSection={true}
        getSectionSuggestions={getSectionSuggestions}
        // onSuggestionUnSelected={this.onSuggestionUnSelected}
        //alwaysRenderSuggestions={true}
      />
    );
  }
}

const DefaultSearchColor = color(colors["dark-brand"])
  .lighten(0.07)
  .string();
const ActiveSearchColor = color(colors["bg-light-dark"])
  .lighten(0.1)
  .string();

const SearchWrapper = Flex.extend`
  ${width} background-color: ${props =>
      props.active ? ActiveSearchColor : DefaultSearchColor};
  border-radius: 6px;
  align-items: center;
  color: white;
  transition: background 300ms ease-in;
  &:hover {
    background-color: ${ActiveSearchColor};
  }
`;

const SearchInput = styled.input`
  ${space} ${width} background-color: transparent;
  border: none;
  color: white;
  font-size: 1em;
  font-weight: 700;
  &:focus {
    outline: none;
  }
  &::placeholder {
    color: ${colors["text-white"]};
  }
`;

class SearchBar extends React.Component {
  static propTypes = {
    inputProps: PropTypes.object.isRequired,
    onChangeLocation: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
  }

  onKeyPress = e => {
    e.preventDefault();
    const { value, suggestions, selected } = this.props.inputProps;
    if (e.key === "Enter" && (value || "").trim().length > 0 && !selected) {
      this.props.onChangeLocation({
        pathname: "search",
        query: { q: value },
      });
    }
  };

  render() {
    let { inputProps, active } = this.props;
    inputProps = {
      ...inputProps,
      onKeyUp: this.onKeyPress,
    };
    return (
      <OnClickOutsideWrapper handleDismissal={() => this.props.setInactive()}>
        <SearchWrapper onClick={() => this.props.setActive()} active={active}>
          <Icon name="search" ml={2} />
          <SearchInput
            w={1}
            py={2}
            pr={2}
            pl={1}
            placeholder={t`Search` + "…"}
            onClick={() => this.props.setActive()}
            {...inputProps}
          />
        </SearchWrapper>
      </OnClickOutsideWrapper>
    );
  }
}

const SearchResultItem = ({ suggestion, query, isHighlighted }) => (
  <div>suggestion.name</div>
);
