import React, { Component } from "react"
import { t } from "c-3po";

export default function connectCrossfilter(chartCrossfilter, dimensionFn) {
    
    return function wrapedWithCrossfilter(WrappedComponent) {
        
        return class extends React.Component {
            constructor (props) {
                super(props);
                this.initializeCharCrossfilter();
            }

            initializeCharCrossfilter() {
                this._crossfilter = this.props.dashCardCrossfilter.crossfilter;
                const dimensionFn = this.props.dimensionFn;
                this._dimension = dimensionFn && this.crossfilter.dimension(dimensionFn);
                this._filters = [];
                this.showResetControl = false;
            }

            disposeDimension() {
                if(this.dimension) {
                    this.dimension.dispose();
                }
                this.dimension = null;
            }

            filterHandler (dimension, filters) {
                if (filters.length === 0) {
                    dimension.filter(null);
                } else if (filters.length === 1 && !filters[0].isFiltered) {
                    dimension.filterExact(filters[0])
                } else if (filters.length === 1 && filters[0].filterType === "RangedFilter") {
                    dimension.filterRange(filters[0]);
                } else {
                    dimension.filterFunction( value => {
                        const length = filters.length;
                        for(let i = 0; i < length; i++) {
                            const filter = filters[i];
                            if (filter.isFiltered && filter.isFiltered(value)) {
                                return true;
                            } else if(filter >= value && filter <= value) {
                                return true;
                            }
                        }
                        return false;
                    })
                }
                return filters;
            }
    
            hasFilterHandler(filters, filter) {
                if(filter === null || typeof(filter) === "undefined") {
                    return filters.length > 0;
                }
                return filters.some(function(currentFilter) {
                    return filter <= currentFilter && filter >= currentFilter;
                })
            }

            hasFilter(filter) {
                return this.hasFilterHandler(this.filters, filter);
            }

            removeFilterHandler(filters, filter) {
                const length = filters.length;
                for(let i = 0; i < length; i++) {
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
            
            turnOnResetControl(){
                this.showResetControl = true;
            }

            turnOffResetControl() {
                this.showResetControl = false;
            }

            filter (filter) {
                if (!arguments.length) {
                    return this._filters.length > 0 ? this._filters[0] : null;
                }
                let filters = this._filters;
                // filter by a set of values
                if (filter instanceof Array && filter[0] instanceof Array && !filter.isFiltered) {
                    filter[0].foreach(value => {
                        if(this.hasFilter(filters, value)) {
                            filters = this.removeFilter(filters, value);
                        } else {
                            filters = this.addFilter(filters, value);
                        }
                    })
                } else if (filter === null) {
                    filters = this.resetFilter(filters);
                } else {
                    if (this.hasFilter(filters, filter)) {
                        filters = this.removeFilter(filters, filter);
                    } else {
                        filters = this.addFilter(filters, filter);
                    }
                }
                this._filters = this.applyFilters(filters);
            }

            render() {
                
                return (
                    <WrappedComponent 
                    { ...this.props}
                    />
                )
            }
        }
    }
  
}