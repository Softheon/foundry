import React, { Component } from "react";

export default function connectCrossfilter(WrappedComponent) {
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.initializeCharCrossfilter();
    }

    initializeCharCrossfilter() {
      const card = this.props.dashcard && this.props.dashcard.card;
      const cardId = card.id;
      this._cardId = cardId;
      this._nativeQuery = this.getNativeQuery();
      this._crossfilter = null;
      this._filters = [];
      this._group = null;
      this.showResetControl = false;
      this._dimension = null;
      this._transitionDuration = 750;
      this._transitionDelay = 0;
      this._keyAccessor = d => d.key;
      this._valueAccessor = d => d.value;
    }

    getNativeQuery() {
      const { dashcard } = this.props;
      if (
        dashcard.card &&
        dashcard.card.dataset_query &&
        dashcard.card.dataset_query.native &&
        dashcard.card.dataset_query.native.query
      ) {
        return dashcard.card.dataset_query.native.query;
      }
      return null;
    }

    filterHandler(dimension, filters) {
      if (filters.length === 0) {
        dimension.filter(null);
      } else if (filters.length === 1 && !filters[0].isFiltered) {
        dimension.filterExact(filters[0]);
      } else if (
        filters.length === 1 &&
        filters[0].filterType === "RangedFilter"
      ) {
        dimension.filterRange(filters[0]);
      } else {
        dimension.filterFunction(value => {
          const length = filters.length;
          for (let i = 0; i < length; i++) {
            const filter = filters[i];
            if (filter.isFiltered && filter.isFiltered(value)) {
              return true;
            } else if (filter >= value && filter <= value) {
              return true;
            }
          }
          return false;
        });
      }
      return filters;
    }

    hasFilterHandler(filters, filter) {
      if (filter === null || typeof filter === "undefined") {
        return filters.length > 0;
      }
      return filters.some(function(f) {
        return filter <= f && filter >= f;
      });
    }

    hasFilter = filter => {
      return this.hasFilterHandler(this._filters, filter);
    };

    removeFilterHandler(filters, filter) {
      const length = filters.length;
      for (let i = 0; i < length; i++) {
        const currentFilter = filters[i];
        if (currentFilter <= filter && currentFilter >= filter) {
          filters.splice(i, 1);
          break;
        }
      }
      return filters;
    }

    addFilterHandler(filters, filter) {
      filters.push(filter);
      return filters;
    }

    resetFilterHandler(filters) {
      return [];
    }

    applyFilters(filters) {
      if (this._dimension && this._dimension.filter) {
        const fs = this.filterHandler(this._dimension, filters);
        if (fs) {
          filters = fs;
        }
        return filters;
      }
    }

    turnOnResetControl = () => {
      this.showResetControl = true;
    };

    turnOffResetControl = () => {
      this.showResetControl = false;
    };

    disposeDimension = () => {
      if (this.dimension) {
        this.dimension.dispose();
      }
      this.dimension = null;
    };

    setDimension = dimension => {
      this._dimension = dimension;
    };

    getDimension = () => {
      return this._dimension;
    };

    data = () => {
      return this._group.all();
    };

    setGroup = group => {
      this._group = group;
    };

    getGroup = () => {
      return this._group;
    };

    filter = filter => {
      let filters = this._filters;
      // filter by a set of values
      if (
        filter instanceof Array &&
        filter[0] instanceof Array &&
        !filter.isFiltered
      ) {
        filter[0].foreach(value => {
          if (this.hasFilterHandler(filters, value)) {
            filters = this.removeFilterHandler(filters, value);
          } else {
            filters = this.addFilterHandler(filters, value);
          }
        });
      } else if (filter === null) {
        filters = this.resetFilterHandler(filters);
      } else {
        if (this.hasFilterHandler(filters, filter)) {
          filters = this.removeFilterHandler(filters, filter);
        } else {
          filters = this.addFilterHandler(filters, filter);
        }
      }
      console.log("xia: applied filters", filters);
      this._filters = this.applyFilters(filters);
    };

    getFilters = () => {
      return this._filters;
    };

    setKeyAccessor = keyAccessor => {
      this._keyAccessor = keyAccessor;
    };

    getKeyAccessor = () => {
      return this._keyAccessor;
    };

    setValueAccessor = valueAccessor => {
      this._valueAccessor = valueAccessor;
    };

    getValueAccessor = () => {
      return this._valueAccessor;
    };

    onCrossfilterClick = (datum, event) => {
      const datumKey = this.getKeyAccessor()(datum);
      this.filter(datumKey);
      this.redrawCrossfilterGroup();
    };

    setTransitionDuration = duration => {
      this._transitionDuration = duration;
    };

    getTransitionDuration = () => {
      return this._transitionDuration;
    }

    setTransitionDelay = delay => {
      this._transitionDelay = delay;
    };

    getTransitionDelay = () => {
      return this._transitionDelay;
    }

    isCrossfilterLoaded = () => {
      return this._crossfilter && !!this._crossfilter.crossfilter;
    };

    disposeDimensionAndGroup = () => {
      if (this._dimension) {
        this._dimension.dispose();
      }
      if (this._group) {
        this._group.dispose();
      }
    };

    onAddCrossfilter = (cardId, data) => {
      this.props.addCrossfilter(cardId, data, this._nativeQuery);
    };

    shouldTurnOnCrossfilter = () => {
      return this.props.belongToACrossfilterGroup(
        this._cardId,
        this._nativeQuery,
      );
    };

    getCrossfilter = () => {
      return this._crossfilter;
    };

    unregisterCrossfilter() {
      this._crossfilter = null;
      if (this._dimension) {
        this._dimension.dispose();
      }
      if (this._group) {
        this._group.dispose();
      }
    }

    redrawCrossfilterGroup = () => {
      this.props.redrawGroup(this._nativeQuery);
    };

    resetActiveCrossfilterGroup = () => {
      this.props.redrawGroup(null);
    };

    addSourceCrossfilterDimensionAndGroup = (
      dimension,
      group,
      dimensionIndex,
      metricIndex,
    ) => {
      this.props.addSourceCrossfilterDimensionAndGroup(
        this._cardId,
        this._nativeQuery,
        dimension,
        group,
        dimensionIndex,
        metricIndex,
      );
    };

    getSourceCrossfilterDimension = () => {
      if (this._crossfilter) {
        return this._crossfilter.dimension;
      }
      return null;
    };

    isCrossfilterSourceCard = () => {
      return this.props.isCrossfilterSource(this._cardId);
    }

    componentDidUpdate() {
      if (!this.shouldTurnOnCrossfilter()) {
        this.unregisterCrossfilter();
      }
    }

    componentWillMount() {
      this.unregisterCrossfilter();
    }

    render() {
      this._crossfilter = this.props.getCrossfilter(
        this._cardId,
        this._nativeQuery,
      );

      return (
        <WrappedComponent
          {...this.props}
          onCrossfilterClick={this.onCrossfilterClick}
          crossfilterTurnOnResetControl={this.turnOnResetControl}
          crossfilterTurnOffResetControl={this.turnOffResetControl}
          setCrossfilterDimension={this.setDimension}
          getCrossfilterDimension={this.getDimension}
          setCrossfilterGroup={this.setGroup}
          getCrossfilterGroup={this.getGroup}
          disposeCrossfilterDimension={this.disposeDimension}
          crossfilterData={this.data}
          crossfilterKeyAccessor={this.keyAccessor}
          crossfilterValueAccessor={this.valueAccessor}
          crossfilterTransitionDuration={this.transitionDuration}
          crossfilterTransitionDelay={this.transitionDelay}
          isCrossfilterLoaded={this.isCrossfilterLoaded}
          getCrossfilter={this.getCrossfilter}
          addCrossfilter={this.onAddCrossfilter}
          disposeDimensionAndGroup={this.disposeDimensionAndGroup}
          enableCrossfilter={this.shouldTurnOnCrossfilter()}
          isCrossfilterSource={this.props.isCrossfilterSource}
          isCrossfilterSourceCard={this.isCrossfilterSourceCard()}
          redrawCrossfilterGroup={this.redrawCrossfilterGroup}
          setCrossfilterKeyAccessor={this.setKeyAccessor}
          addSourceCrossfilterDimensionAndGroup={
            this.addSourceCrossfilterDimensionAndGroup
          }
          getSourceCrossfilterDimension={this.getSourceCrossfilterDimension}
          hasFilter={this.hasFilter}
          activeGroup={this.props.activeGroup}
          crossfilterGroup={this._nativeQuery}
          resetActiveCrossfilterGroup={this.resetActiveCrossfilterGroup}
        />
      );
    }
  };
}
