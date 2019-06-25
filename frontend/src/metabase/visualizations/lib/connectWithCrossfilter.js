import React, { Component } from "react";

export default function connectWithCrossfilter(WrappedComponent) {
  return class extends React.Component {
    static uiName = WrappedComponent.uiName;
    static identifier = WrappedComponent.identifier;
    static iconName = WrappedComponent.iconName;
    static minSize = WrappedComponent.minSize;
    static isSensible = WrappedComponent.isSensible;
    static checkRenderable = WrappedComponent.checkRenderable;
    static settings = WrappedComponent.settings;
    static columnSettings = WrappedComponent.columnSettings;
    static seriesAreCompatible = WrappedComponent.seriesAreCompatible;
    static transformSeries = WrappedComponent.transformSeries;
    constructor(props) {
      super(props);
      this.initializeCharCrossfilter();
    }

    componentWillUnmount() {
      this.unregisterCrossfilter();
    }

    initializeCharCrossfilter() {
      const card = this.props.card;
      this._cardId = card.id;
      this._nativeQuery = this.getNativeQuery();
      console.log("xia: native query", this._nativeQuery);
      this._crossfilter = this.getSourceCrossfilter();
      this._filters = [];
      this._group = null;
      this.showResetControl = false;
      this._dimension = null;
      this._transitionDuration = 750;
      this._transitionDelay = 0;
      this._keyAccessor = d => d.key;
      this._valueAccessor = d => d.value;
      console.log("xia: connectWithCrossfilter, initializaeCharCrossfitler");
    }

    getNativeQuery() {
      const { card } = this.props;
      if (card && card.dataset_query && card.dataset_query.native && card.dataset_query.native.query) {
        return card.dataset_query.native.query;
      }
      return null;
    }

    filterHandler(dimension, filters) {
      if (filters.length === 0) {
        dimension.filter(null);
      } else if (filters.length === 1 && !filters[0].isFiltered) {
        dimension.filterExact(filters[0]);
      } else if (filters.length === 1 && filters[0].filterType === "RangedFilter") {
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

    setCrossfilter = crossfilter => {
      this._crossfilter = crossfilter;
    };

    getCrossfilter = () => {
      return this._crossfilter;
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
      if (filter instanceof Array && filter[0] instanceof Array && !filter.isFiltered) {
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
      console.log("set key accessor", keyAccessor);
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
      console.log("xia onCrossfilter click, datum", datum);
      const datumKey = this.getKeyAccessor()(datum);
      console.log("xia", this.getKeyAccessor());
      console.log("xia onCrossfilterClick, filterdKey", datumKey);
      this.filter(datumKey);
      this.redrawCrossfilterGroup();
    };

    setTransitionDuration = duration => {
      this._transitionDuration = duration;
    };

    getTransitionDuration = () => {
      return this._transitionDuration;
    };

    setTransitionDelay = delay => {
      this._transitionDelay = delay;
    };

    getTransitionDelay = () => {
      return this._transitionDelay;
    };

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
      return this.props.belongToACrossfilterGroup(this._cardId, this._nativeQuery);
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

    addSourceCrossfilter = ({ crossfilter, dimension, group, dimensionIndex, metricIndex } = {}) => {
      this.setCrossfilter(crossfilter);
      this.setDimension(dimension);
      this.setGroup(group);
      this.props.addCrossfilterGroup({
        crossfilter,
        dimension,
        group,
        dimensionIndex,
        metricIndex
      });
    };

    getSourceCrossfilter = () => {
      if (this._crossfilter) {
        return this._crossfilter;
      } else {
        return this.props.getSharedCrossfilter(this._cardId, this._nativeQuery);
      }
    };

    render() {
      return <WrappedComponent {...this.props} onClick={this.onCrossfilterClick} turnOnResetControl={this.turnOnResetControl} turnOffResetControl={this.turnOffResetControl} setDimension={this.setDimension} getDimension={this.getDimension} setGroup={this.setGroup} getGroup={this.getGroup} crossfilterData={this.data} getKeyAccessor={this.getKeyAccessor} setKeyAccessor={this.setKeyAccessor} getValueAccessor={this.getValueAccessor} setValueAccessor={this.setValueAccessor} setTransitionDuration={this.setTransitionDuration} getTransitionDuration={this.getTransitionDuration} setTransitionDelay={this.setTransitionDelay} getTransitionDelay={this.getTransitionDelay} isCrossfilterSource={this.props.isCrossfilterSource} addSourceCrossfilter={this.addSourceCrossfilter} getSourceCrossfilter={this.getSourceCrossfilter} redrawCrossfilterGroup={this.redrawCrossfilterGroup} getSourceCrossfilterDimension={this.getSourceCrossfilterDimension} hasFilter={this.hasFilter} activeCrossfilterGroup={this.props.activeGroup} crossfilterGroup={this._nativeQuery} resetActiveCrossfilterGroup={this.resetActiveCrossfilterGroup} />;
    }
  };
}
