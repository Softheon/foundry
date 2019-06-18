import React, { Component } from "react";
import crossfilter from "crossfilter";
import { connect } from "react-redux";
import { replace } from "react-router-redux";

import { getIn } from "icepick";
import type { LocationDescriptor } from "metabase/meta/types";

/* This contains some state for dashboard controls on both private and embedded dashboards.
 */
export default (ComposedComponent: ReactClass<any>) =>
  connect(null, { replace })(
    class extends Component {
      static displayName = "DashboardCrossfilterControl[" +
        (ComposedComponent.displayName || ComposedComponent.name) +
        "]";

      state = {
        redrawAt: new Date(),
      };

      componentWillMount() {
        this.chartMap = {}
        this.chartGroupMapping = new Map();
      }

      getCrossfilterParameters() {
        const { dashboard } = this.props;
        const { parameters } = dashboard;
        return parameters.filter(parameter => {
          return parameter.type && parameter.type === "crossfilter";
        });
      }

      updateDashboardCrossfilters() {
        const cfParameters = this.getCrossfilterParameters();
        const oldCrossfilters = this.state.crossfitlers;
        // remove any inactive crossfilters;
        const cfParameterIdSet = new Set();
        let isDirty = false;
        cfParameters.map(cfParameter => {
          cfParameterIdSet.add(cfParameter.card_id);
        });

        for (const crossfilterId in oldCrossfilters) {
          if (!cfParameterIdSet.has(crossfilterId)) {
            isDirty = true;
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
            if (data.length === 0) {
              return;
            }
            const crossfilterObject = crossfilter(data);
            newCrossfilters[card_id] = {
              crossfilter: crossfilterObject,
              dimensions: {},
              card_id: card_id,
              dashcard_id: dashcard_id,
              updateAt: new Date(),
            };
            isDirty = true;
          }
          const currentCrossfilter = newCrossfilters[card_id];
          const selectedDimensionValues = this.selectedDimensionValues(
            cfParameter,
          );
          const dimensionValueSet = new Set(selectedDimensionValues);
          const dimensions = currentCrossfilter.dimensions;
          // dispose inactive dimensions
          for (const dimensionName in dimensions) {
            if (!dimensionValueSet.has(dimensionName)) {
              dimensions[dimensionName].dispose();
              delete dimensions[dimensionName];
              isDirty = true;
            }
          }
          // add new dimensions
          const crossfilterObject = currentCrossfilter.crossfilter;
          for (const dimensionName of selectedDimensionValues) {
            if (!dimensions[dimensionName]) {
              dimensions[dimensionName] = crossfilterObject.dimension(d => {
                return d[dimensionName];
              });
              isDirty = true;
            }
          }
        });

        if (isDirty) {
          this.setState({
            crossfilters: newCrossfilters,
          });
          //console.log("xia: current crossfilter", newCrossfilters);
        }
      }

    
      resetCrossfilter(dashcardId, cardId) {
        const cfParameters = this.getCrossfilterParameters();
        const cfParameterIdSet = new Set();
        cfParameters.map(cfParameter => {
          cfParameterIdSet.add(cfParameter.card_id);
        });
        for(const crossfilterId in this.chartMap) {
          if (!cfParameterIdSet.has(crossfilterId)) {
              delete this.chartMap[crossfilterId];
              const native = this.getNativeQuery(dashcardId);
              if (native && this.chartGroupMapping.has(native)) {
                this.chartGroupMapping.delete(native);
              }
          }
        }
      }

      getDashcard(dashcardId, cardId) {
        const { dashcards } = this.props;
        const dashcard = dashcards[dashcardId];
        return dashcard;
      }

      getNativeQuery (dashcardId) {
        const dashcard = this.getDashcard(dashcardId);
        const card = dashcard.card;
        const native = card.dataset_query && card.dataset_query.query && 
          card.dataset_query.query.native;
        return native;
      }
      addCrossfilter(dashcardId, cardId, data) {
        this.resetCrossfilter(dashcardId, cardId);
        this.chartMap[cardId] = {
          card_id: cardId,
          crossfilter: crossfilter(data),
          group: [],
          dashcard: this.getDashcard(dashcardId, cardId),
        }

        const native = this.getNativeQuery(dashcardId);
        if (native && native.length > 0) {
          if (!this.chartGroupMapping.has(native)) {
            this.chartGroupMapping.set(native, this.chartMap[cardId]);
          }        
        }
        this.setState({redrawAt : new Date()});
      }

      getCrossfilter(dashcard) {
        const native = this.getNativeQuery(dashcardId);
        if (native && native.length > 0 ) {
          if (this.chartGroupMapping.has(native)){
            return this.chartGroupMapping.get(native);
          }
        }
        return null;
      }

      // normalize a card data to an array of record thats can be understood by crossfilter
      normalizeCardData(crossfilterParamter) {
        const { card_id, dashcard_id } = crossfilterParamter;
        const { dashcardData } = this.props;
        const data = getIn(dashcardData, [dashcard_id, card_id, "data"]);
        if (!data) {
          return [];
        }
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
        return <ComposedComponent {...this.props} 
        chartMap={this.chartMap}
        addCrossfilter = {this.addCrossfilter}
        getCrossfilter = {this.getCrossfilter}
        />;
      }
    },
  );
