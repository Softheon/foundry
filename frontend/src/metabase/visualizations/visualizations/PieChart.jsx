/* @flow */

import React, { Component } from "react";
import ReactDOM from "react-dom";
import styles from "./PieChart.css";
import { t } from "c-3po";
import ChartTooltip from "../components/ChartTooltip.jsx";
import ChartWithLegend from "../components/ChartWithLegend.jsx";

import { ChartSettingsError } from "metabase/visualizations/lib/errors";
import {
  getFriendlyName,
  getDynamicFilterData
} from "metabase/visualizations/lib/utils";
import {
  metricSetting,
  dimensionSetting,
} from "metabase/visualizations/lib/settings/utils";
import { columnSettings } from "metabase/visualizations/lib/settings/column";

import { formatValue, numberFormatterForOptions } from "metabase/lib/formatting";

import colors, { getColorsForValues } from "metabase/lib/colors";

import cx from "classnames";

import d3, { svg } from "d3";
import _ from "underscore";

const OUTER_RADIUS = 50; // within 100px canvas
const INNER_RADIUS_RATIO = 3 / 5;

const PAD_ANGLE = Math.PI / 180 * 1; // 1 degree in radians
const SLICE_THRESHOLD = 0.025; // approx 1 degree in percentage
const OTHER_SLICE_MIN_PERCENTAGE = 0.003;

const PERCENT_REGEX = /percent/i;

import type { VisualizationProps } from "metabase/meta/types/Visualization";

export default class PieChart extends Component {
  props: VisualizationProps;

  static uiName = t`Pie`;
  static identifier = "pie";
  static iconName = "pie";

  static minSize = { width: 4, height: 4 };

  static isSensible({ cols, rows }) {
    return cols.length === 2;
  }

  static checkRenderable(series, settings) {
    if (!settings["pie.dimension"] || !settings["pie.metric"]) {
      throw new ChartSettingsError(t`Which columns do you want to use?`, {
        section: `Data`,
      });
    }
    const dynamicFilterEnabled = settings["pie.aggregation_enabled"];
    if (dynamicFilterEnabled && series.length > 1) {
      throw new ChartSettingsError(
        t`Aggregation does not support multiple series`,
        { section: t`Data` },
        t`Update fields`,
      )
    }
  }

  static settings = {
    ...columnSettings({ hidden: true }),
    ...dimensionSetting("pie.dimension", {
      section: t`Data`,
      title: t`Dimension`,
      showColumnSetting: true,
    }),
    ...metricSetting("pie.metric", {
      section: t`Data`,
      title: t`Measure`,
      showColumnSetting: true,
    }),
    "pie.aggregation_enabled": {
      section: t`Data`,
      title: t`Aggregation`,
      widget: "buttonGroup",
      props: {
        options: [
          { name: t`On`, value: true },
          { name: t`Off`, value: false }
        ]
      },
      getHidden: ([{ card }], vizSettings) => {
        const queryType = card.dataset_query && card.dataset_query.type;
        if (!queryType || queryType !== "native") {
          return true;
        }
        return !vizSettings["pie.metric"];
      },
      getDefault: ([{ card }], vizSettings) => {
        return vizSettings["pie.aggregation_enabled"];
      },
      readDependencies: ["pie.metric"]
    },
    "pie.dynamic_filter_aggregation": {
      section: t`Data`,
      title: t`Aggregation type`,
      widget: "select",
      props: {
        options: [
          { name: t`Sum`, value: "sum" },
          { name: t`Count`, value: "count" }
        ]
      },
      getHidden: (single, vizSettings) => !vizSettings["pie.aggregation_enabled"],
      getDefault: (single, vizSettings) => "sum",
      readDependencies: ["pie.aggregation_enabled"],
    },
    "pie.show_legend": {
      section: t`Display`,
      title: t`Show legend`,
      widget: "toggle",
    },
    "pie.show_legend_perecent": {
      section: t`Display`,
      title: t`Show percentages in legend`,
      widget: "toggle",
      default: true,
    },
    "pie.slice_threshold": {
      section: t`Display`,
      title: t`Minimum slice percentage`,
      widget: "number",
      default: SLICE_THRESHOLD * 100,
    },
    "pie.colors": {
      section: t`Display`,
      title: t`Colors`,
      widget: "colors",
      getDefault: (series, settings) =>
        settings["pie._dimensionValues"]
          ? getColorsForValues(settings["pie._dimensionValues"])
          : [],
      getProps: (series, settings) => ({
        seriesTitles: settings["pie._dimensionValues"] || [],
      }),
      getDisabled: (series, settings) => !settings["pie._dimensionValues"],
      readDependencies: ["pie._dimensionValues"],
    },
    // this setting recomputes color assignment using pie.colors as the existing
    // assignments in case the user previous modified pie.colors and a new value
    // has appeared. Not ideal because those color values will be missing in the
    // settings UI
    "pie._colors": {
      getValue: (series, settings) =>
        getColorsForValues(
          settings["pie._dimensionValues"],
          settings["pie.colors"],
        ),
      readDependencies: ["pie._dimensionValues", "pie.colors"],
    },
    "pie._metricIndex": {
      getValue: ([{ data: { cols } }], settings) =>
        _.findIndex(cols, col => col.name === settings["pie.metric"]),
      readDependencies: ["pie.metric"],
    },
    "pie._dimensionIndex": {
      getValue: ([{ data: { cols } }], settings) =>
        _.findIndex(cols, col => col.name === settings["pie.dimension"]),
      readDependencies: ["pie.dimension"],
    },
    "pie._dimensionValues": {
      getValue: ([{ data: { rows } }], settings) => {
        const dimensionIndex = settings["pie._dimensionIndex"];
        return dimensionIndex >= 0
          ? // cast to string because getColorsForValues expects strings
          rows.map(row => String(row[dimensionIndex]))
          : null;
      },
      readDependencies: ["pie._dimensionIndex"],
    },
  };

  componentDidUpdate() {
    // let groupElement = ReactDOM.findDOMNode(this.refs.group);
    // let detailElement = ReactDOM.findDOMNode(this.refs.detail);
    // if (groupElement.getBoundingClientRect().width < 100) {
    //   detailElement.classList.add("hide");
    // } else {
    //   detailElement.classList.remove("hide");
    // } 
  }

  computeWidthandHeight = () => {
    const GRID_ASPECT_RATIO = 4 / 3;
    const PADDING = 14;
    let {
      gridSize,
      aspectRatio,
      height,
      width,
      settings
    } = this.props;

    const showLegend = settings["pie.show_legend"];
    let chartWidth, chartHeight;
    let isHorizontal = gridSize && gridSize.width > gridSize.height / GRID_ASPECT_RATIO;
    if (!gridSize || (!isHorizontal && (showLegend || gridSize.width > 4 || gridSize.height > 4))) {
      let desiredWidth = height * aspectRatio;
      if (desiredWidth <= width * (2 / 3)) {
        chartWidth = desiredWidth;
      }
      else {
        chartWidth = height;
      }
      chartHeight = height;
    } else if (
      !isHorizontal &&
      (showLegend || (gridSize.height > 3 && gridSize.width > 2))
    ) {

      let desiredHeight = width * (1 / aspectRatio);
      if (desiredHeight > height * (3 / 4)) {
        // chartHeight = height * (3 / 4);
        chartHeight = width;
      } else {
        chartHeight = desiredHeight;
      }
      chartWidth = width;
    }
    else {
      const min = Math.min(width, height);
      chartWidth = chartHeight = min;
    }
    return { width: chartWidth, height: chartHeight };
  }

  render() {
    const {
      series,
      hovered,
      onHoverChange,
      visualizationIsClickable,
      onVisualizationClick,
      className,
      gridSize,
      settings,
    } = this.props;

    let [{ data: { cols, rows } }] = series;
    const dimensionIndex = settings["pie._dimensionIndex"];
    const metricIndex = settings["pie._metricIndex"];

    const dynamicFilterEnabled = settings["pie.aggregation_enabled"];
    if (dynamicFilterEnabled) {
      const aggregationType = settings["pie.dynamic_filter_aggregation"];
      const dynamicFilterData = getDynamicFilterData(series[0], {
        dimensionIndex,
        metricIndex,
        aggregationType,
      })
      cols = dynamicFilterData.cols;
      rows = dynamicFilterData.rows;
    }

    const formatDimension = (dimension, jsx = true) =>
      formatValue(dimension, {
        ...settings.column(cols[dimensionIndex]),
        jsx,
        majorWidth: 0,
      });
    const formatMetric = (metric, jsx = true) =>
      formatValue(metric, {
        ...settings.column(cols[metricIndex]),
        jsx,
        majorWidth: 0,
      });
    const formatPercent = (percent, jsx = true) => {
      const formatter = numberFormatterForOptions({
        ...settings.column(cols[metricIndex]),
        jsx,
        majorWidth: 0,
        number_style: "percent",
        minimumSignificantDigits: 3,
        maximumSignificantDigits: 3,
      });
      return formatter.format(percent);
    }
  

    const showPercentInTooltip =
      !PERCENT_REGEX.test(cols[metricIndex].name) &&
      !PERCENT_REGEX.test(cols[metricIndex].display_name);

    let total: number = rows.reduce((sum, row) => sum + row[metricIndex], 0);

    let sliceThreshold =
      typeof settings["pie.slice_threshold"] === "number"
        ? settings["pie.slice_threshold"] / 100
        : SLICE_THRESHOLD;

    let [slices, others] = _.chain(rows)
      .map((row, index) => ({
        key: row[dimensionIndex],
        value: row[metricIndex],
        percentage: row[metricIndex] / total,
        color: settings["pie._colors"][row[dimensionIndex]],
      }))
      .partition(d => d.percentage > sliceThreshold)
      .value();

    let otherSlice;
    if (others.length > 1) {
      let otherTotal = others.reduce((acc, o) => acc + o.value, 0);
      if (otherTotal > 0) {
        otherSlice = {
          key: "Other",
          value: otherTotal,
          percentage: otherTotal / total,
          color: colors["text-light"],
        };
        slices.push(otherSlice);
      }
    } else {
      slices.push(...others);
    }

    // increase "other" slice so it's barely visible
    // $FlowFixMe
    if (otherSlice && otherSlice.percentage < OTHER_SLICE_MIN_PERCENTAGE) {
      otherSlice.value = total * OTHER_SLICE_MIN_PERCENTAGE;
    }
    slices.sort((a, b) => a.percentage - b.percentage);
    let legendTitles = slices.map(slice => [
      slice.key === "Other" ? slice.key : formatDimension(slice.key, true),
      settings["pie.show_legend_perecent"]
        ? formatPercent(slice.percentage, true)
        : undefined,
    ]);
    let legendColors = slices.map(slice => slice.color);

    // no non-zero slices
    if (slices.length === 0) {
      otherSlice = {
        value: 1,
        color: colors["text-light"],
        noHover: true,
      };
      slices.push(otherSlice);
    }

     let { width, height } = this.computeWidthandHeight();

    width = height = height * 3/4;
    const radius = Math.min(width, height) / 2;
    //     .outerRadius(radius - 1)
    //     .innerRadius(radius * INNER_RADIUS_RATIO))
    const pie = d3.layout
      .pie()
      .sort(null)
      .padAngle(PAD_ANGLE)
      .value(d => d.value);
    const arc = d3.svg
      .arc()
      .outerRadius(radius - 1)
      .innerRadius(radius * INNER_RADIUS_RATIO);

    // .outerRadius(OUTER_RADIUS)
    // .innerRadius(OUTER_RADIUS * INNER_RADIUS_RATIO);

    function hoverForIndex(index, event) {
      const slice = slices[index];
      if (!slice || slice.noHover) {
        return null;
      } else if (slice === otherSlice) {
        return {
          index,
          event: event && event.nativeEvent,
          data: others.map(o => ({
            key: formatDimension(o.key, false),
            value: formatMetric(o.value, false),
          })),
        };
      } else {
        return {
          index,
          event: event && event.nativeEvent,
          data: [
            {
              key: getFriendlyName(cols[dimensionIndex]),
              value: formatDimension(slice.key),
            },
            {
              key: getFriendlyName(cols[metricIndex]),
              value: formatMetric(slice.value),
            },
          ].concat(
            showPercentInTooltip && slice.percentage != null
              ? [
                {
                  key: "Percentage",
                  value: formatPercent(slice.percentage),
                },
              ]
              : [],
          ),
        };
      }
    }

    let value, title;
    if (
      hovered &&
      hovered.index != null &&
      slices[hovered.index] !== otherSlice
    ) {
      title = formatDimension(slices[hovered.index].key);
      value = formatMetric(slices[hovered.index].value);
    } else {
      title = t`Total`;
      value = formatMetric(total);
    }

    const getSliceClickObject = index => ({
      value: slices[index].value,
      column: cols[metricIndex],
      dimensions: [
        {
          value: slices[index].key,
          column: cols[dimensionIndex],
        },
      ],
    });

    const isClickable =
      onVisualizationClick && visualizationIsClickable(getSliceClickObject(0));
    const getSliceIsClickable = index =>
      isClickable && slices[index] !== otherSlice;


    return (
      <ChartWithLegend
        className={className}
        legendTitles={legendTitles}
        legendColors={legendColors}
        gridSize={gridSize}
        hovered={hovered}
        onHoverChange={d =>
          onHoverChange &&
          onHoverChange(d && { ...d, ...hoverForIndex(d.index) })
        }
        showLegend={settings["pie.show_legend"]}
      >
        <div className={styles.ChartAndDetail}
          style={{marginTop: "50px" , marginLeft:"50px"}}
          ref="container">
          {/* <div ref="detail" className={styles.Detail}>
            <div
              className={cx(
                styles.Value,
                "fullscreen-normal-text fullscreen-night-text",
              )}
            >
              {value}
            </div>
            <div className={styles.Title}>{title}</div>
          </div> */}
          <div
            // className={styles.Chart} 
            
          >
            <svg viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`} height={height} width={width}>
              {/* <g ref="group" transform={`translate(310,310)`}>
                {pie(slices).map((slice, index) => (
                  <path
                    key={index}
                    d={arc(slice)}
                    fill={slices[index].color}
                    opacity={
                      hovered &&
                      hovered.index != null &&
                      hovered.index !== index
                        ? 0.3
                        : 1
                    }
                    onMouseMove={e =>
                      onHoverChange && onHoverChange(hoverForIndex(index, e))
                    }
                    onMouseLeave={() => onHoverChange && onHoverChange(null)}
                    className={cx({
                      "cursor-pointer": getSliceIsClickable(index),
                    })}
                    onClick={
                      getSliceIsClickable(index) &&
                      (e =>
                        onVisualizationClick({
                          ...getSliceClickObject(index),
                          event: e.nativeEvent,
                        }))
                    }
                  />
                ))}
              </g> */}
              {pie(slices).map((slice, index) => (
                <path
                  key={index}
                  d={arc(slice)}
                  fill={slices[index].color}
                  opacity={
                    hovered &&
                      hovered.index != null &&
                      hovered.index !== index
                      ? 0.3
                      : 1
                  }
                  onMouseMove={e =>
                    onHoverChange && onHoverChange(hoverForIndex(index, e))
                  }
                  onMouseLeave={() => onHoverChange && onHoverChange(null)}
                  className={cx({
                    "cursor-pointer": getSliceIsClickable(index),
                  })}
                  onClick={
                    getSliceIsClickable(index) &&
                    (e =>
                      onVisualizationClick({
                        ...getSliceClickObject(index),
                        event: e.nativeEvent,
                      }))
                  }
                />
              ))}
              <text textAnchor="middle" className={cx(
                styles.Value,
                "fullscreen-normal-text fullscreen-night-text",
              )}>{value}</text>
              <text textAnchor="middle" className={styles.Title} y="20">{title}</text>
            </svg>
          </div>
        </div>
        <ChartTooltip series={series} hovered={hovered} />
      </ChartWithLegend>
    );
  }
}