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
      if (dashcard.card &&
        dashcard.card.dataset_query &&
        dashcard.card.dataset_query.native &&
        dashcard.card.dataset_query.native.query) {
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

    dimension = dimension => {
      if (!arguments.length) {
        console.log("xia: [connectCrossfilter] current dimension", dimension);
        return this._dimension;
      }
      console.log("xia: [connectCrossfilter] adding dimension", dimension)
      this._dimension = dimension;
    };

     
    data = () => {
      return this._group.all();
    };

    group = group => {
      if (!arguments.length) {
        return this._group;
      }
      this._group = group;
    };

    filter = filter => {
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
    };

    getFilters = () => {
      return this._filters;
    };

    keyAccessor = keyAccessor => {
      if (!arguments.length) {
        return this._keyAccessor;
      }
      this._keyAccessor = keyAccessor;
    };

    valueAccessor = valueAccessor => {
      if (!arguments.length) {
        return this._valueAccessor;
      }
      this._valueAccessor = valueAccessor;
    };

    onCrossfilterClick = datum => {
      const datumKey = this.keyAccessor()(datum);
      this.filter(datumKey);
      this.props.redrawGroup();
    };

    transitionDuration = duration => {
      if (!arguments.length) {
        return this._transitionDuration;
      }
      this._transitionDuration = duration;
    };

    transitionDelay = delay => {
      if (!arguments.length) {
        return this._transitionDelay;
      }
      this._transitionDelay = delay;
    };

    isCrossfilterLoaded = () => {
  
      return this._crossfilter 
      && !!this._crossfilter.crossfilter;
    };

    disposeDimensionAndGroup = () => {
      if (this._dimension) {
        this._dimension.dispose();
      }
      if(this._group) {
        this._group.dispose();
      }
    }

    onAddCrossfilter = (cardId, data) => {
      this.props.addCrossfilter(cardId, data, this._nativeQuery);
    }
    
    shouldTurnOnCrossfilter = () => {
     // return this.props.belongToACrossfilterGroup(this._cardId, this._nativeQuery);
      return this._cardId === 441;
    }

    getCrossfilter = () => {
      return this._crossfilter;
    }
    render() {
      this._crossfilter = this.props.getCrossfilter(this._cardId, this._nativeQuery);
      console.log("connectCrossfilter: dashcard id ", this.props.dashcard);
      console.log("connectCrossfilter: enable crossfilter", this.shouldTurnOnCrossfilter());
      return (
        <WrappedComponent
          {...this.props}
          onCrossfilterClick={this.onCrossfilterClick}
          crossfilterTurnOnResetControl={this.turnOnResetControl}
          crossfilterTurnOffResetControl={this.turnOffResetControl}
          crossfilterDimension={this.dimension}
          crossfilterDisposeDimension={this.disposeDimension}
          crossfilterGroup={this.group}
          crossfilterData={this.data}
          crossfilterKeyAccessor={this.keyAccessor}
          crossfilterValueAccessor={this.valueAccessor}
          crossfilterTransitionDuration={this.transitionDuration}
          crossfilterTransitionDelay={this.transitionDelay}

          isCrossfilterLoaded={this.isCrossfilterLoaded}
          getCrossfilter={this.getCrossfilter}
          addCrossfilter={this.onAddCrossfilter}
          disposeDimensionAndGroup={this.disposeDimensionAndGroup}
          enableCrossfilter= {this.shouldTurnOnCrossfilter()}
          isCrossfilterSource={this.props.isCrossfilterSource}
        />
      );
    }
  };
}
