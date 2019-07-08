/* @flow */

import { t } from "c-3po";
import CrossfilterLineAreaBarChart from "../components/CrossfilterLineAreaBarChart.jsx";
import { CrossfilterScatterRenderer } from "../lib/CrossfilterLineAreaBarRenderer";
import connectWithCrossfilter from "../lib/connectWithCrossfilter.js";
import {
  GRAPH_DATA_SETTINGS,
  GRAPH_BUBBLE_SETTINGS,
  GRAPH_GOAL_SETTINGS,
  GRAPH_COLORS_SETTINGS,
  GRAPH_AXIS_SETTINGS
} from "../lib/settings/graph";

@connectWithCrossfilter
export default class CrossfilterScatterPlot extends CrossfilterLineAreaBarChart {
  static uiName = t`Scatter`;
  static identifier = "scatter";
  static iconName = "bubble";
  static noun = t`scatter plot`;

  static renderer = CrossfilterScatterRenderer;

  static settings = {
    ...GRAPH_DATA_SETTINGS,
    ...GRAPH_BUBBLE_SETTINGS,
    ...GRAPH_GOAL_SETTINGS,
    ...GRAPH_COLORS_SETTINGS,
    ...GRAPH_AXIS_SETTINGS
  };
}
