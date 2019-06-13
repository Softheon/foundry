// import React, { Component } from "react";
// import { connect } from "react-redux";
// import crossfilter from "crossfilter";

// /**
//  *  Crossfilter
//  *   {
//  *
//  *    crossfilterId: {
//  *          crossfitler:
//  *          dimensions: {
//  *            dimensonName: dimension
//  *              }
//  *        }
//  *
//  *
//  * }
//  *
//  */

// export default (ComposedComponent) =>
//   connect(null, null)(
//     class extends Component {
//       static displayName = "DashboardCrossFilterControls[" +
//         (ComposedComponent.displayName || ComposedComponent.name) +
//         "]";

//         constructor(props) {
//           super(props);
//           this.state({
//             crossfilters: {}
//           })
//         }

//         componentWillMount() {
//             this.initializeCrossfilters();
//         }
//         componentWillUnmount() {}
//         componentDidUpdate() {
//             this.updateCrossfilters();
//         }

//         initializeCrossfilters () {
//           const cfParameters = this.getCrossfilterParameters();
//           const oldCrossfilters = this.state.crossfitlers;
//           const newCrossfilters = {
//             ...oldCrossfilters
//           }
//           cfParameters.map(cfParameter => {
//             const data = this.normalizeCardData(cfParameter);
//             const crossfilter = crossfilter(data);

//           })

//         }

//         getCrossfilterParameters () {
//           const { dashboard } = this.props;
//           const { parameters } = dashboard;
//           return parameters.filter(parameter => {
//             return parameter.type && parameter.type === "crossfilter";
//           })
//         }

//         updateCrossfilters(){

//         }

//         // normalize a card data to an array of record thats can be understood by crossfilter
//         normalizeCardData(crossfilterParamter) {

//         }

//         selectedDimensionValues(crossfilterParameter) {

//         }
//         render () {
//           console.log("xia: props [DashboardCrossfilterControl]", this.props);
//             return (
//                 <ComposedComponent
//                  {...this.props}
//                  {...this.state}
//                 />
//             )
//         }
//     },
//   );

import React, { Component } from "react";

import { connect } from "react-redux";
import { replace } from "react-router-redux";

import MetabaseAnalytics from "metabase/lib/analytics";
import { parseHashOptions, stringifyHashOptions } from "metabase/lib/browser";

import screenfull from "screenfull";
import { getIn } from "icepick";
import type { LocationDescriptor } from "metabase/meta/types";
import crossfilter from "crossfilter";

/* This contains some state for dashboard controls on both private and embedded dashboards.
 * It should probably be in Redux?
 */
export default (ComposedComponent: ReactClass<any>) =>
  connect(null, { replace })(
    class extends Component {
      static displayName = "DashboardCrossfilterControl[" +
        (ComposedComponent.displayName || ComposedComponent.name) +
        "]";

      state = {
        crossfilters: null,
      };

      initializeCrossfilters() {
        const cfParameters = this.getCrossfilterParameters();
        const oldCrossfilters = this.state.crossfitlers;

      // remove any inactive crossfilters;
        const cfParameterIdSet = new Set();
        
        cfParameters.map(cfParameter => {
          cfParameterIdSet.add(cfParameter.card_id);
        })

        for(const crossfilterId in oldCrossfilters) {
          if (!cfParameterIdSet.has(crossfilterId)) {
            delete oldCrossfilters[crossfilterId];
          }
        }

        const newCrossfilters = {
          ...oldCrossfilters,
        };
        // initialize any new crossfilter
        cfParameters.map(cfParameter => {
          const { card_id, dashcard_id }  = cfParameter;
          if(!newCrossfilters[card_id]) {
            const data = this.normalizeCardData(cfParameter);
            const crossfilter = crossfilter(data);
            newCrossfilters[card_id] = {
              crossfilter: crossfilter,
              dimensions: {}
            }
          }
          const currentCrossfilter = newCrossfilters[card_id];
          const selectedDimensionValues  = selectedDimensionValues(cfParameter);
          const dimensionValueSet = new Set(selectedDimensionValues);
          const dimensions = currentCrossfilter.dimensions;
          // dispose inactive dimensions
          for(const dimensionName in dimensions) {
              if (!dimensionValueSet.has(dimensionName)){
                  dimensions[dimensionName].dispose();
                  delete dimensions[dimensionName];
              }
          }
          // add new dimensions
          const crossfilterObject = currentCrossfilter.crossfilter;
          for(const dimensionName of selectedDimensionValues) {
            if (!dimensions[dimensionName]) {
                dimensions[dimensionName] = crossfilterObject.dimension(
                  d => {
                    return d[dimensionName];
                  }
                )
            }
          }
        });
      }

      getCrossfilterParameters() {
        const { dashboard } = this.props;
        const { parameters } = dashboard;
        return parameters.filter(parameter => {
          return parameter.type && parameter.type === "crossfilter";
        });
      }

      updateCrossfilters() {}

      // normalize a card data to an array of record thats can be understood by crossfilter
      normalizeCardData(crossfilterParamter) {
        const {card_id, dashcard_id } = crossfilterParamter;
        const { dashcardData } = this.props;
        const data = getIn(dashcardData, [dashcard_id, card_id, "data"]);
        const {cols , columns, rows } = data;
        const result = [];
        const rowCount = rows.length;
        const colCount = cols.length;
        for (let i = 0; i < rowCount; i++) {
            const normalizedRow = {};
            const currentRow = rows[i];
            for(let j = 0; j < colCount; j++) {
              normalizedRow[columns[j]] = currentRow[j];
            }
            result.push(normalizedRow);
        }
        return result;
      }

      selectedDimensionValues(crossfilterParameter) {
        
      }

      
      render() {
        console.log("xia: props [DashboardCrossfilterControl]", this.props);
        return <ComposedComponent {...this.props} {...this.state} />;
      }
    },
  );
