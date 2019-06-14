import React, { Component } from "react";
import crossfilter from "crossfilter";
import { connect } from "react-redux";
import { replace } from "react-router-redux";

import { getIn } from "icepick";
import type { LocationDescriptor } from "metabase/meta/types";

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

      componentDidMount() {
        // this.initializeCrossfilters();
        this.initializeCrossfilters();
      }

      componentDidUpdate() {
        this.updateCrossfilters();
      }

      initializeCrossfilters() {


        const cfParameters = this.getCrossfilterParameters();
        const oldCrossfilters = this.state.crossfitlers;
        console.log("xia: cfParameters", cfParameters);

        // remove any inactive crossfilters;
        const cfParameterIdSet = new Set();

        cfParameters.map(cfParameter => {
          cfParameterIdSet.add(cfParameter.card_id);
        });

        for (const crossfilterId in oldCrossfilters) {
          if (!cfParameterIdSet.has(crossfilterId)) {
            delete oldCrossfilters[crossfilterId];
          }
        }

        const newCrossfilters = {
          ...oldCrossfilters,
        };

        // initialize any new crossfilter
        cfParameters.map(cfParameter => {
          const { card_id, dashcard_id } = cfParameter;
          if (!newCrossfilters[card_id]) {
            const data = this.normalizeCardData(cfParameter);
            const crossfilterObject = crossfilter(data);
            newCrossfilters[card_id] = {
              crossfilter: crossfilterObject,
              dimensions: {},
              card_id: card_id,
              dashcard_id: dashcard_id,
              updateAt: new Date(),
            };
          }
          const currentCrossfilter = newCrossfilters[card_id];
          const selectedDimensionValues = this.selectedDimensionValues(cfParameter);
          const dimensionValueSet = new Set(selectedDimensionValues);
          const dimensions = currentCrossfilter.dimensions;
          // dispose inactive dimensions
          for (const dimensionName in dimensions) {
            if (!dimensionValueSet.has(dimensionName)) {
              dimensions[dimensionName].dispose();
              delete dimensions[dimensionName];
            }
          }
          // add new dimensions
          const crossfilterObject = currentCrossfilter.crossfilter;
          for (const dimensionName of selectedDimensionValues) {
            if (!dimensions[dimensionName]) {
              dimensions[dimensionName] = crossfilterObject.dimension(d => {
                return d[dimensionName];
              });
            }
          }
        });

        this.setState({
          crossfilters: newCrossfilters
        })
      }

      getCrossfilterParameters() {
        const { dashboard } = this.props;
        const { parameters } = dashboard;
        return parameters.filter(parameter => {
          return parameter.type && parameter.type === "crossfilter";
        });
      }

      updateCrossfilters() {}

      isLoading() {
      
      }
      // normalize a card data to an array of record thats can be understood by crossfilter
      normalizeCardData(crossfilterParamter) {
        const { card_id, dashcard_id } = crossfilterParamter;
        const { dashcardData } = this.props;
        const data = getIn(dashcardData, [dashcard_id, card_id, "data"]);
        console.log("xia: all properties", this.props);
        console.log("xia: normalize crossfilter parameter", crossfilterParamter);
        console.log("xia: all dashcard car data", dashcardData);
        console.log("xia: dash card data", data);
        // if (!data) {
        //   return [];
        // }
  
        const { cols, columns, rows } = data;
        const result = [];
        const rowCount = rows.length;
        const colCount = cols.length;
        for (let i = 0; i < rowCount; i++) {
          const normalizedRow = {};
          const currentRow = rows[i];
          for (let j = 0; j < colCount; j++) {
            normalizedRow[columns[j]] = currentRow[j];
          }
          result.push(normalizedRow);
        }
        return result;
      }

      selectedDimensionValues(crossfilterParameter) {
        const { parameterValues } = this.props;
        const parameterId = crossfilterParameter.id;
        let dimensionValues = parameterValues[parameterId];
        if (!Array.isArray(dimensionValues)) {
          dimensionValues = [dimensionValues];
        }
        return dimensionValues ? dimensionValues : [];
      }

      render() {
        return <ComposedComponent {...this.props} {...this.state} />;
      }
    },
  );
