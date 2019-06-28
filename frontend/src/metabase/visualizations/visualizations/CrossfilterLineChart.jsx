/* @flow */

import { t } from "c-3po";
import CrossfilterLineAreaBarChart from "../components/CrossfilterLineAreaBarChart.jsx";
import { CrossfilterLineRenderer } from "../lib/CrossfilterLineAreaBarRenderer";
import connectWithCrossfilter from "../lib/connectWithCrossfilter.js";
import {
  GRAPH_DATA_SETTINGS,
  LINE_SETTINGS,
  GRAPH_GOAL_SETTINGS,
  GRAPH_COLORS_SETTINGS,
  GRAPH_AXIS_SETTINGS,
} from "../lib/settings/graph";

@connectWithCrossfilter
export default class CrossfilterLineChart extends CrossfilterLineAreaBarChart {
  static uiName = t`Line`;
  static identifier = "line";
  static iconName = "line";
  static noun = t`line chart`;

  static settings = {
    ...GRAPH_DATA_SETTINGS,
    ...LINE_SETTINGS,
    ...GRAPH_GOAL_SETTINGS,
    ...GRAPH_COLORS_SETTINGS,
    ...GRAPH_AXIS_SETTINGS,
  };

  static renderer = CrossfilterLineRenderer;
}
