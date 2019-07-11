import React, { Component } from "react";
import d3 from "d3";
const SELECTED_CLASS = "selected";
const DESELECTED_CLASS = "deselected";

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
    static noHeader = WrappedComponent.noHeader;
    static aliases = WrappedComponent.aliases;

    constructor(props) {
      super(props);
      this.initializeCharCrossfilter();
    }

    componentWillUnmount() {
      this.unregisterCrossfilter();
    }

    initializeCharCrossfilter() {
      this._chartGroup = this.props.chartGroup;
      this._crossfilter = null;
      this._crossfilter = this.getSourceCrossfilter();
      this._filters = [];
      this._group = null;
      this.showResetControl = false;
      this._dimension = null;
      this._transitionDuration = 750;
      this._transitionDelay = 0;
      this._keyAccessor = d => d.key;
      this._valueAccessor = d => d.value;
  
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

    filterAll = () => {
      this.filter(null);
      this.redrawCrossfilterGroup();
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

    highlightSelected = e => {
      d3.select(e).attr("fill-opacity", 1);
    };

    fadeDeselected = e => {
      d3.select(e).attr("fill-opacity", 0.3);
    };

    resetHighlight = e => {
      d3.select(e).attr("fill-opacity", 1);
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
    };

    setTransitionDelay = delay => {
      this._transitionDelay = delay;
    };

    getTransitionDelay = () => {
      return this._transitionDelay;
    };

    isCrossfilterLoaded = () => {
      return this.props.isChartGroupLoaded();
    };

    disposeDimensionAndGroup = () => {
      if (this._dimension) {
        this._dimension.dispose();
      }
      if (this._group) {
        this._group.dispose();
      }
    };

    shouldTurnOnCrossfilter = () => {
      return this.props.enableCrossfilter;
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
      this.props.redrawChartGroup();
    };

    addSourceCrossfilter = ({
      crossfilter,
      dimension,
      group,
      dimensionIndex,
      metricIndex,
    } = {}) => {
      this.setCrossfilter(crossfilter);
      this.setDimension(dimension);
      this.setGroup(group);
      this.props.loadChartGroup({
        crossfilter,
        dimension,
        group,
        dimensionIndex,
        metricIndex,
      })
    };

    getSourceCrossfilter = () => {
      if (this._crossfilter){
        return this._crossfilter;
      }
      return this.props.getChartGroupCrossfilter();
    };

    render() { 
      return (
        <WrappedComponent
          {...this.props}
          turnOnResetControl={this.turnOnResetControl}
          turnOffResetControl={this.turnOffResetControl}
          setDimension={this.setDimension}
          getDimension={this.getDimension}
          setGroup={this.setGroup}
          getGroup={this.getGroup}
          crossfilterData={this.data}
          getKeyAccessor={this.getKeyAccessor}
          setKeyAccessor={this.setKeyAccessor}
          getValueAccessor={this.getValueAccessor}
          setValueAccessor={this.setValueAccessor}
          setTransitionDuration={this.setTransitionDuration}
          getTransitionDuration={this.getTransitionDuration}
          setTransitionDelay={this.setTransitionDelay}
          getTransitionDelay={this.getTransitionDelay}
          hasFilter={this.hasFilter}
          highlightSelected={this.highlightSelected}
          fadeDeselected={this.fadeDeselected}
          resetHighlight={this.resetHighlight}
          filterAll={this.filterAll}
          filter={this.filter}
          crossfilterGroup={this.props.chartGroup}
          activeCrossfilterGroup={this.props.activeGroup}
          isCrossfilterSource={this.props.isSourceChartGroup}
          addSourceCrossfilter={this.addSourceCrossfilter}
          getSourceCrossfilter={this.getSourceCrossfilter}
          redrawCrossfilterGroup={this.redrawCrossfilterGroup}
          onClick={this.onCrossfilterClick}
        />
      );
    }
  };
}
