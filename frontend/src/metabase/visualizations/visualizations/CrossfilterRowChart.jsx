/* @flow */

import { t } from "c-3po";
import CrossfilterLineAreaBarChart from "../components/CrossfilterLineAreaBarChart.jsx";
import crossfilterRowRenderer from "../lib/CrossfilterRowRender.js";
import connectWithCrossfilter from "../lib/connectWithCrossfilter.js";
import {
  GRAPH_DATA_SETTINGS,
  GRAPH_COLORS_SETTINGS
} from "metabase/visualizations/lib/settings/graph";

@connectWithCrossfilter
export default class CrossfilterRowChart extends CrossfilterLineAreaBarChart {
  static uiName = t`Row Chart`;
  static identifier = "row";
  static iconName = "horizontal_bar";
  static noun = t`row chart`;

  static supportsSeries = false;

  static renderer = crossfilterRowRenderer;

  static settings = { ...GRAPH_DATA_SETTINGS, ...GRAPH_COLORS_SETTINGS };
}

// rename these settings
CrossfilterRowChart.settings["graph.metrics"] = {
  ...CrossfilterRowChart.settings["graph.metrics"],
  title: t`X-axis`
};
CrossfilterRowChart.settings["graph.dimensions"] = {
  ...CrossfilterRowChart.settings["graph.dimensions"],
  title: t`Y-axis`
};
