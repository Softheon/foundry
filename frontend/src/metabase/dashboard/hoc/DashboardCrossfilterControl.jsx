import React, { Component } from "react";
import crossfilter from "crossfilter";
import { connect } from "react-redux";
import { replace } from "react-router-redux";
import { getIn } from "icepick";

import type { LocationDescriptor } from "metabase/meta/types";
import { nativeQueryGroupsBySQL } from "../selectors";

const mapStateToProps = (state, props) => {
  return {
    nativeQueryGroupsBySQL: nativeQueryGroupsBySQL(state, props),
  };
};

export default (ComposedComponent: ReactClass<any>) =>
  connect(mapStateToProps, { replace })(
    class extends Component {
      static displayName = "DashboardCrossfilterControl[" +
        (ComposedComponent.displayName || ComposedComponent.name) +
        "]";

      state = {
        activeGroup: new Set(),
      };

      componentWillMount() {
        this._crossfilterMap = new Map();
        this.updateCrossfilterMap();
      }

      componentWillUpdate() {
        this.updateCrossfilterMap();
      }

      getCrossfilterParameters() {
        const { dashboard } = this.props;
        const { parameters } = dashboard;
        return parameters.filter(parameter => {
          return parameter.type && parameter.type === "crossfilter";
        });
      }

      getCardIdSetBySQL(nativeSql) {
        const groups = this.props.nativeQueryGroupsBySQL;
        if (groups.has(nativeSql)) {
          return groups.get(nativeSql);
        }
        return new Set();
      }

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
              dimension: null,
              group: null,
              cardId: parameter.card_id,
              cardIdSetOfTheSameSQL: this.getCardIdSetBySQL(nativeQuery),
            });
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
        for (let crossfilterInfo of this._crossfilterMap) {
          const { cardId } = crossfilterInfo[1];
          if (cardId === id) {
            return true;
          }
        }
        return false;
      };

      addCrossfilter = (cardId, data, native) => {
        if (this.isCrossfilterSource(cardId)) {
          const crossfilterInstance = crossfilter(data);
          if (!native) {
            native = this.getNativeQuery(cardId);
          }
          if (this._crossfilterMap.has(native)) {
            const crossfilterInfo = this._crossfilterMap.get(native);
            crossfilterInfo.crossfilter = crossfilterInstance;
          }
        }
        console.log(
          "xia: current crossfilter map after adding a crossfilter,",
          this._crossfilterMap,
        );
      };

      addSourceCrossfilterDimensionAndGroup = (
        cardId,
        native,
        dimension,
        group,
      ) => {
        if (this.isCrossfilterSource(cardId)) {
          if (!native) {
            native = this.getNativeQuery(cardId);
          }
          if (this._crossfilterMap.has(native)) {
            const crossfilterInfo = this._crossfilterMap.get(native);
            crossfilterInfo.dimension = dimension;
            crossfilterInfo.group = group;
            console.log("xia: added source crossfilter dimension");
            console.log(this._crossfilterMap);
          }
        }
      };

      belongToACrossfilterGroup = (cardId, native) => {
        if (!native) {
          native = this.getNativeQuery(cardId);
        }
        return this._crossfilterMap.has(native);
      };

      redrawGroup = group => {
        if (this._crossfilterMap.has(group)) {
          const crossfilterGroup = this._crossfilterMap.get(group);
          this.setState({
            activeGroup: crossfilterGroup.cardIdSetOfTheSameSQL,
          });
        }
      };

      render() {
        return (
          <ComposedComponent
            {...this.props}
            addCrossfilter={this.addCrossfilter}
            removeCrossfilter={this.removeCrossfilter}
            getCrossfilter={this.getCrossfilter}
            isCrossfilterSource={this.isCrossfilterSource}
            belongToACrossfilterGroup={this.belongToACrossfilterGroup}
            redrawGroup={this.redrawGroup}
            activeGroup={this.state.activeGroup}
            addSourceCrossfilterDimensionAndGroup={
              this.addSourceCrossfilterDimensionAndGroup
            }
          />
        );
      }
    },
  );
