import React, { Component } from "react";
import crossfilter from "crossfilter";
import { connect } from "react-redux";
import { replace } from "react-router-redux";

import { getIn } from "icepick";
import type { LocationDescriptor } from "metabase/meta/types";

export default (ComposedComponent: ReactClass<any>) =>
  connect(null, { replace })(
    class extends Component {
      static displayName = "DashboardCrossfilterControl[" +
        (ComposedComponent.displayName || ComposedComponent.name) +
        "]";

      state = {
        updateAt: new Date(),
      };

      componentWillMount() {
        this.chartMap = new Map();
        this.chartGroupMapping = new Map();
        this._crossfilterMap = new Map();
      }

      getCrossfilterParameters() {
        const { dashboard } = this.props;
        const { parameters } = dashboard;
        return parameters.filter(parameter => {
          return parameter.type && parameter.type === "crossfilter";
        });
      }

      // updateDashboardCrossfilters() {
      //   const cfParameters = this.getCrossfilterParameters();
      //   const oldCrossfilters = this.state.crossfitlers;
      //   // remove any inactive crossfilters;
      //   const cfParameterIdSet = new Set();
      //   let isDirty = false;
      //   cfParameters.map(cfParameter => {
      //     cfParameterIdSet.add(cfParameter.card_id);
      //   });

      //   for (const crossfilterId in oldCrossfilters) {
      //     if (!cfParameterIdSet.has(crossfilterId)) {
      //       isDirty = true;
      //       delete oldCrossfilters[crossfilterId];
      //     }
      //   }

      //   const newCrossfilters = {
      //     ...oldCrossfilters,
      //   };

      //   // initialize any new crossfilter
      //   cfParameters.map(cfParameter => {
      //     const { card_id, dashcard_id } = cfParameter;
      //     if (!newCrossfilters[card_id]) {
      //       const data = this.normalizeCardData(cfParameter);
      //       if (data.length === 0) {
      //         return;
      //       }
      //       const crossfilterObject = crossfilter(data);
      //       newCrossfilters[card_id] = {
      //         crossfilter: crossfilterObject,
      //         dimensions: {},
      //         card_id: card_id,
      //         dashcard_id: dashcard_id,
      //         updateAt: new Date(),
      //       };
      //       isDirty = true;
      //     }
      //     const currentCrossfilter = newCrossfilters[card_id];
      //     const selectedDimensionValues = this.selectedDimensionValues(
      //       cfParameter,
      //     );
      //     const dimensionValueSet = new Set(selectedDimensionValues);
      //     const dimensions = currentCrossfilter.dimensions;
      //     // dispose inactive dimensions
      //     for (const dimensionName in dimensions) {
      //       if (!dimensionValueSet.has(dimensionName)) {
      //         dimensions[dimensionName].dispose();
      //         delete dimensions[dimensionName];
      //         isDirty = true;
      //       }
      //     }
      //     // add new dimensions
      //     const crossfilterObject = currentCrossfilter.crossfilter;
      //     for (const dimensionName of selectedDimensionValues) {
      //       if (!dimensions[dimensionName]) {
      //         dimensions[dimensionName] = crossfilterObject.dimension(d => {
      //           return d[dimensionName];
      //         });
      //         isDirty = true;
      //       }
      //     }
      //   });

      //   if (isDirty) {
      //     this.setState({
      //       crossfilters: newCrossfilters,
      //     });
      //     //console.log("xia: current crossfilter", newCrossfilters);
      //   }
      // }

      getNativeQuery(cardId) {
        let { dashcards } = this.props;
        dashcards = Object.values(dashcards);
        const count = dashcards.length;
        let native = null;
        for (let i = 0; i < count; i++) {
          const dashcard = dashcards[i];
          if (dashcard.card_id === cardId) {
            const card = dashcard.card;
            native =
              card.dataset_query &&
              card.dataset_query.native &&
              card.dataset_query.native.query;
            break;
          }
        }
        return native;
      }

      resetCrossfilter(cardId) {
        const cfParameters = this.getCrossfilterParameters();
        const cfParameterCardIdSet = new Set();
        cfParameters.map(cfParameter => {
          cfParameterCardIdSet.add(cfParameter.card_id);
        });
        for (const crossfilterId in this.chartMap) {
          if (!cfParameterCardIdSet.has(crossfilterId)) {
            delete this.chartMap[crossfilterId];
            const native = this.getNativeQuery(cardId);
            if (native && this.chartGroupMapping.has(native)) {
              this.chartGroupMapping.delete(native);
            }
          }
        }
      }

      // selectedDimensionValues(crossfilterParameter) {
      //   const { parameterValues } = this.props;
      //   const parameterId = crossfilterParameter.id;
      //   let dimensionValues = parameterValues[parameterId];
      //   if (!Array.isArray(dimensionValues)) {
      //     dimensionValues = [dimensionValues];
      //   }
      //   return dimensionValues ? dimensionValues : [];
      // }

      redrawGroup = () => {
        this.setState({
          updateAt: new Date(),
        });
      };
      
      updateCrossfilterMap() {
        const cfParameter = this.getCrossfilterParameters();
        const crossfilterCardIds = new Set();
        const crossfilterMap = this._crossfilterMap;
        // add new crossfilter groups
        cfParameter.map(parameter => {
          crossfilterCardIds.add(parameter.card_id);
          const nativeQuery = this.getNativeQuery(parameter.card_id);
          if (!crossfilterMap.has(nativeQuery)) {
            crossfilterMap.set(nativeQuery, {
              crossfilter: null,
              cardId: parameter.card_id,
              //cardGroup: new Set([parameter.card_id])
            })
          }
        });

        const entries = crossfilterMap.entries();
        const invalidCrossfilters = [];
        for (let entry of entries) {
          const crossfilterInfo = entry[1];
          const { cardId } = crossfilterInfo;
          if (!crossfilterCardIds.has(cardId)) {
            invalidCrossfilters.push(entry[0]);
          }
        }
        invalidCrossfilters.map(key => crossfilterMap.delete(key));
      
        this._crossfilterMap = crossfilterMap;
      }

      getCrossfilter = (cardId, native) => {
        if (!native) {
          native = this.getNativeQuery(cardId);
        }
        if (native && native.length > 0) {
          if (this._crossfilterMap.has(native)) {
            return this._crossfilterMap.get(native);
          }
        }
        return null;
      };

      isCrossfilterSource = id => {
        for(let crossfilterInfo of this._crossfilterMap) {
          const { cardId } = crossfilterInfo[1];
          if (cardId === id) {
            return true;
          }
        }
        return false;
      };

      addCrossfilter = (cardId, data, native) => {
        console.log("xia: adding crossfilterxxx")
        if (this.isCrossfilterSource(cardId)) {
            const crossfilterInstance = crossfilter(data);
          if (!native) {
            native = this.getNativeQuery(cardId);
          }
          if (this._crossfilterMap.has(native)) {
            const crossfilterInfo = this._crossfilterMap.get(native);
            crossfilterInfo.crossfilter = crossfilterInstance;
          }
          console.log("xia: current crossfitler map after adding a new crossfilter",
           this._crossfilterMap)
          this.setState({ updateAt: new Date() });
        }
      };

      belongToACrossfilterGroup = (cardId, native) => {
        if (!native) {
          native = this.getNativeQuery(cardId);
        }
        return this._crossfilterMap.has(native);
      };

      render() {
        this.updateCrossfilterMap();

        return (
          <ComposedComponent
            {...this.props}
            addCrossfilter={this.addCrossfilter}
            removeCrossfilter={this.removeCrossfilter}
            getCrossfilter={this.getCrossfilter}
            redrawGroup={this.redrawGroup}
            isCrossfilterSource={this.isCrossfilterSource}
            belongToACrossfilterGroup={this.belongToACrossfilterGroup}
          />
        );
      }
    },
  );
