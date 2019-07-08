/* @flow */

import { t } from "c-3po";
import CrossfilterLineAreaBarChart from "../components/CrossfilterLineAreaBarChart.jsx";
import { CrossfilterAreaRenderer } from "../lib/CrossfilterLineAreaBarRenderer";
import connectWithCrossfilter from "../lib/connectWithCrossfilter.js";

import {
  GRAPH_DATA_SETTINGS,
  STACKABLE_SETTINGS,
  GRAPH_GOAL_SETTINGS,
  GRAPH_COLORS_SETTINGS,
  GRAPH_AXIS_SETTINGS
} from "../lib/settings/graph";

@connectWithCrossfilter
export default class CrossfilterBarChart extends CrossfilterLineAreaBarChart {
  static uiName = t`Bar`;
  static identifier = "bar";
  static iconName = "bar";
  static noun = t`bar chart`;

  static settings = {
    ...GRAPH_DATA_SETTINGS,
    ...STACKABLE_SETTINGS,
    ...GRAPH_GOAL_SETTINGS,
    ...GRAPH_COLORS_SETTINGS,
    ...GRAPH_AXIS_SETTINGS
  };

  static renderer = CrossfilterAreaRenderer;
}
