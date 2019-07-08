/* @flow */

import { t } from "c-3po";
import CrossfilterLineAreaBarChart from "../components/CrossfilterLineAreaBarChart.jsx";
import connectWithCrossfilter from "../lib/connectWithCrossfilter.js";
import { CrossfilterAreaRenderer } from "../lib/CrossfilterLineAreaBarRenderer";
import {
  GRAPH_DATA_SETTINGS,
  LINE_SETTINGS,
  STACKABLE_SETTINGS,
  GRAPH_GOAL_SETTINGS,
  GRAPH_COLORS_SETTINGS,
  GRAPH_AXIS_SETTINGS
} from "../lib/settings/graph";

@connectWithCrossfilter
export default class CrossfilterAreaChart extends CrossfilterLineAreaBarChart {
  static uiName = t`Area`;
  static identifier = "area";
  static iconName = "area";
  static noun = t`area chart`;

  static settings = {
    ...GRAPH_DATA_SETTINGS,
    ...LINE_SETTINGS,
    ...STACKABLE_SETTINGS,
    ...GRAPH_GOAL_SETTINGS,
    ...GRAPH_COLORS_SETTINGS,
    ...GRAPH_AXIS_SETTINGS
  };

  static renderer = CrossfilterAreaRenderer;
}
