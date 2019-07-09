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
        activeGroup: null,
      };

      componentWillMount() {
        this.initialization();
      }

      componentDidUpdate() {
        this.resetActiveChartGroup();
      }

      componentWillUpdate() {
        this.updateChartGroup();
      }

      getCrossfilterParameters() {
        const { dashboard } = this.props;
        const { parameters } = dashboard;
        return parameters.filter(parameter => {
          return parameter.type && parameter.type === "crossfilter";
        });
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

      initialization = () => {
        this._chartGroup = new Map();
        this._nativeToGroupMap = new Map();
        this._groupSourceSet = new Set();
        this.updateChartGroup();
      };

      updateChartGroup = () => {
        const params = this.getCrossfilterParameters();
        const currentParams = new Set();
        params.map(param => {
          currentParams.add(param.id);
          const nativeQuery = this.getNativeQuery(param.card_id);
          const paramId = param.id;
          if (!this._nativeToGroupMap.has(nativeQuery)) {
            this._groupSourceSet.add(param.card_id);
            this._nativeToGroupMap.set(nativeQuery, paramId);
            this._chartGroup.set(paramId, {
              crossfilter: null,
              dimension: null,
              group: null,
              dimensionIndex: null,
              metricIndex: null,
              ...param,
              cardId: param.card_id,
              groupId: param.id,
              loaded: false,
            });
          }
        });

        // remove invalid chart group
        const entries = this._chartGroup.entries();
        for (let entry of entries) {
          const chartGroupId = entry[0];
          if (!currentParams.has(chartGroupId)) {
            this._chartGroup.delete(chartGroupId);
          }
        }
      };

      isSourceChartGroup = cardId => {
        return this._groupSourceSet.has(cardId);
      };

      getChartGroup = native => {
        if (!native) {
          return null;
        }
        return this._nativeToGroupMap.has(native)
          ? this._nativeToGroupMap.get(native)
          : null;
      };

      getChartGroupDetail = groupId => {
        return this._chartGroup.has(groupId)
          ? this._chartGroup.get(groupId)
          : null;
      };

      isChartGroupLoaded = groupId => {
        if (!this._chartGroup.has(groupId)) {
          return false;
        }
        const { loaded } = this._chartGroup.get(groupId);
        return loaded;
      };

      loadChartGroup = (
        groupId,
        { crossfilter, dimension, group, dimensionIndex, metricIndex },
      ) => {
        if (this._chartGroup.has(groupId)) {
          const chartGroup = this._chartGroup.get(groupId);
          chartGroup.crossfilter = crossfilter;
          chartGroup.dimension = dimension;
          chartGroup.group = group;
          chartGroup.dimensionIndex = dimensionIndex;
          chartGroup.metricIndex = metricIndex;
          chartGroup.loaded = true;
        }
      };

      redrawChartGroup = groupId => {
        this.setState({
          activeGroup: groupId,
        });
      };

      resetActiveChartGroup = () => {
        if (this.state.activeGroup !== "-1") {
          this.setState({
            activeGroup: "-1",
          });
        }
      };

      getChartGroupCrossfilter = groupId => {
        if (groupId && this._chartGroup.has(groupId)) {
          const { crossfilter } = this._chartGroup.get(groupId);
          return crossfilter;
        }
        return null;
      };

      render() {
        return (
          <ComposedComponent
            {...this.props}
            redrawGroup={this.redrawGroup}
            activeGroup={this.state.activeGroup}
            isSourceChartGroup={this.isSourceChartGroup}
            getChartGroup={this.getChartGroup}
            getChartGroupDetail={this.getChartGroupDetail}
            isChartGroupLoaded={this.isChartGroupLoaded}
            loadChartGroup={this.loadChartGroup}
            redrawChartGroup={this.redrawChartGroup}
            getChartGroupCrossfilter={this.getChartGroupCrossfilter}
          />
        );
      }
    },
  );
