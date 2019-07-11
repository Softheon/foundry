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
        chartGroup: new Map(),
        nativeToGroupMap: new Map(),
        groupSourceSet: new Set()
      };

      componentWillMount() {
        this.initialization();
      }

      componentDidUpdate() {
        this.resetActiveChartGroup();
        this.updateChartGroup();
      }

      componentWillUpdate() {
       // this.updateChartGroup();
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
        this.updateChartGroup();
      };

      updateChartGroup = () => {
        const params = this.getCrossfilterParameters();
        const currentParams = new Set();
        const { chartGroup, nativeToGroupMap, groupSourceSet} = this.state
        let hasChange = false;
        params.map(param => {
          currentParams.add(param.id);
          const nativeQuery = this.getNativeQuery(param.card_id);
          const paramId = param.id;
          if (!nativeToGroupMap.has(nativeQuery)) {
            hasChange = true;
            groupSourceSet.add(param.card_id);
            nativeToGroupMap.set(nativeQuery, paramId);
            chartGroup.set(paramId, {
              crossfilter: null,
              dimension: null,
              group: null,
              dimensionIndex: null,
              metricIndex: null,
              ...param,
              cardId: param.card_id,
              groupId: param.id,
              query: nativeQuery,
              loaded: false,
            });
          }
        });

        // remove invalid chart group
        const entries = chartGroup.entries();
        for (let entry of entries) {
          const chartGroupId = entry[0];
          const chartGroupDetail = entry[1];
          if (!currentParams.has(chartGroupId)) {
            hasChange = true;
            chartGroup.delete(chartGroupId);
            nativeToGroupMap.delete(chartGroupDetail.query);
            groupSourceSet.delete(chartGroupDetail.cardId);
          }
        }
        if (hasChange) {
          this.setState({
            chartGroup: chartGroup,
            nativeToGroupMap: nativeToGroupMap,
            groupSourceSet: groupSourceSet
          })
        }
      };

      isSourceChartGroup = cardId => {
        const {groupSourceSet} = this.state
        return groupSourceSet.has(cardId);
      };

      getChartGroup = native => {
        const {nativeToGroupMap} = this.state
        if (!native) {
          return null;
        }
        return nativeToGroupMap.has(native)
          ? nativeToGroupMap.get(native)
          : null;
      };

      getChartGroupDetail = groupId => {
        const {chartGroup} = this.state
        return chartGroup.has(groupId)
          ? chartGroup.get(groupId)
          : null;
      };

      isChartGroupLoaded = groupId => {
        const {chartGroup} = this.state
        if (!chartGroup.has(groupId)) {
          return false;
        }
        const { loaded } = chartGroup.get(groupId);
        return loaded;
      };

      loadChartGroup = (
        groupId,
        { crossfilter, dimension, group, dimensionIndex, metricIndex },
      ) => {
        const {chartGroup} = this.state
        if (chartGroup.has(groupId)) {
          const chartGroupDetail = chartGroup.get(groupId);
          chartGroupDetail.crossfilter = crossfilter;
          chartGroupDetail.dimension = dimension;
          chartGroupDetail.group = group;
          chartGroupDetail.dimensionIndex = dimensionIndex;
          chartGroupDetail.metricIndex = metricIndex;
          chartGroupDetail.loaded = true;
        }
        this.setState({
          chartGroup: chartGroup
        })
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
        const {chartGroup} = this.state
        if (groupId && chartGroup.has(groupId)) {
          const { crossfilter } = chartGroup.get(groupId);
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
