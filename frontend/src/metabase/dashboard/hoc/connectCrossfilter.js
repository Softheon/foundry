import React, { Component } from "react";

export default function connectCrossfilter(chartCrossfilter, dimensionFn) {
  return function wrapedWithCrossfilter(WrappedComponent) {
    return class extends React.Component {
      constructor(props) {
        super(props);
        this.initializeCharCrossfilter();
      }

      initializeCharCrossfilter() {
        this._filters = [];
        this._group = null;
        this.showResetControl = false;
        this._dimension = null;
        this._crossfilter = this.props.dashCardCrossfilter.crossfilter;
        const dimensionFn = this.props.dimensionFn;
        this._dimension =
          dimensionFn && this.crossfilter.dimension(dimensionFn);
      }

      disposeDimension() {
        if (this.dimension) {
          this.dimension.dispose();
        }
        this.dimension = null;
      }

      data(group) {
        return group.all();
      }

      group(group) {
          if (!arguments.length) {
              return this._group;
          }
          this._group = group;
      }

      dimension(dimension) {
          if (!arguments.length) {
              return this._dimension;
          }
          this._dimension = dimension;
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

      hasFilter(filter) {
        return this.hasFilterHandler(this._filters, filter);
      }

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
        if (this._dimension && this.dimension.filter) {
          const fs = this.filterHandler(this._dimension, filters);
          if (fs) {
            filters = fs;
          }
          return filters;
        }
      }

      turnOnResetControl() {
        this.showResetControl = true;
      }

      turnOffResetControl() {
        this.showResetControl = false;
      }

      filter(filter) {
        if (!arguments.length) {
          return this._filters.length > 0 ? this._filters[0] : null;
        }
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
      }

      render() {
        return (<WrappedComponent {...this.props} />);
      }
    };
  };
}
