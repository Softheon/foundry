/* eslint-disable no-color-literals */

import React, { Component } from "react";
import { t } from "c-3po";
import crossfilter from "crossfilter";
import LoadingSpinner from "metabase/components/LoadingSpinner.jsx";

import { isString } from "metabase/lib/schema_metadata";
import { MinColumnsError } from "metabase/visualizations/lib/errors";
import MetabaseSettings from "metabase/lib/settings";

import { formatValue } from "metabase/lib/formatting";

import ChartWithLegend from "./ChartWithLegend.jsx";
import LegacyChoropleth from "./LegacyChoropleth.jsx";
import LeafletChoropleth from "./LeafletChoropleth.jsx";

import {
  computeMinimalBounds,
  getCanonicalRowKey,
} from "metabase/visualizations/lib/mapping";

import d3 from "d3";
import ss from "simple-statistics";
import _ from "underscore";
import Color from "color";

// TODO COLOR
const HEAT_MAP_COLORS = ["#C4E4FF", "#81C5FF", "#51AEFF", "#1E96FF", "#0061B5"];
const HEAT_MAP_ZERO_COLOR = "#CCC";

export function getColorplethColorScale(
  color,
  { lightness = 92, darken = 0.2, darkenLast = 0.3, saturate = 0.1 } = {},
) {
  let lightColor = Color(color)
    .lightness(lightness)
    .saturate(saturate);

  let darkColor = Color(color)
    .darken(darken)
    .saturate(saturate);

  const scale = d3.scale
    .linear()
    .domain([0, 1])
    .range([lightColor.string(), darkColor.string()]);

  const colors = d3.range(0, 1.25, 0.25).map(value => scale(value));

  if (darkenLast) {
    colors[colors.length - 1] = Color(color)
      .darken(darkenLast)
      .saturate(saturate)
      .string();
  }

  return colors;
}

const geoJsonCache = new Map();
function loadGeoJson(geoJsonPath, callback) {
  if (geoJsonCache.has(geoJsonPath)) {
    setTimeout(() => callback(geoJsonCache.get(geoJsonPath)), 0);
  } else {
    d3.json(geoJsonPath, json => {
      geoJsonCache.set(geoJsonPath, json);
      callback(json);
    });
  }
}

export default class CrossfilterChoroplethMap extends Component {
  static propTypes = {};

  static minSize = { width: 4, height: 4 };

  static isSensible({ cols, rows }) {
    return cols.length > 1 && isString(cols[0]);
  }

  static checkRenderable([{ data: { cols, rows } }]) {
    if (cols.length < 2) {
      throw new MinColumnsError(2, cols.length);
    }
  }

  constructor(props, context) {
    super(props, context);
    this.state = {
      geoJson: null,
      geoJsonPath: null,
    };
    const { isCrossfilterSource, enableCrossfilter } = this.props;
    let dataset = null;
    if (isCrossfilterSource && enableCrossfilter) {
      const { rawSeries } = this.props;
      const [{ data: { rows } }] = rawSeries;
      dataset = crossfilter(rows);
    } else if (enableCrossfilter) {
      dataset = this.props.getSourceCrossfilter();
    }
    if (enableCrossfilter) {
      const { dimension, dimensionIndex } = this.initializeDimension(dataset);
      const { group, metricIndex } = this.initializeGroup(dimension);
      if (enableCrossfilter) {
        this.props.addSourceCrossfilter({
          crossfilter: dataset,
          dimension,
          group,
          dimensionIndex,
          metricIndex,
        });
      } else {
        this.props.setDimension(dimension);
        this.props.setGroup(group);
      }
    }
  }

  initializeDimension(crossfilter) {
    const { settings, series } = this.props;
    const [{ data: { cols } }] = series;
    const dimensionIndex = _.findIndex(
      cols,
      col => col.name === settings["map.dimension"],
    );
    const dimension = crossfilter.dimension(d => d[dimensionIndex]);
    return { dimension, dimensionIndex };
  }

  initializeGroup(dimension) {
    const { settings, series } = this.props;
    const [{ data: { cols } }] = series;
    const metricIndex = _.findIndex(
      cols,
      col => col.name === settings["map.metric"],
    );
    const group = dimension.group().reduceSum(d => {
      console.log("reducing group", d[metricIndex]);
      return d[metricIndex];
    });
    return { group, metricIndex };
  }

  getFilteredRows = () => {
    const data = this.props.crossfilterData();
    return data.map(d => [d.key, d.value]);
  };

  isSelectedNode = d => {
    return this.props.hasFilter(d);
  };

  componentWillMount() {
    this.componentWillReceiveProps(this.props);
  }

  componentDidMount() {
    const { isCrossfilterSource, enableCrossfilter } = this.props;
    if (isCrossfilterSource && enableCrossfilter) {
      this.props.redrawCrossfilterGroup();
    }
  }

  _getDetails(props) {
    return MetabaseSettings.get("custom_geojson", {})[
      props.settings["map.region"]
    ];
  }

  componentWillReceiveProps(nextProps) {
    const details = this._getDetails(nextProps);
    if (details) {
      let geoJsonPath;
      if (details.builtin) {
        geoJsonPath = details.url;
      } else {
        geoJsonPath = "api/geojson/" + nextProps.settings["map.region"];
      }
      if (this.state.geoJsonPath !== geoJsonPath) {
        this.setState({
          geoJson: null,
          geoJsonPath: geoJsonPath,
        });
        loadGeoJson(geoJsonPath, geoJson => {
          this.setState({
            geoJson: geoJson,
            geoJsonPath: geoJsonPath,
            minimalBounds: computeMinimalBounds(geoJson.features),
          });
        });
      }
    }
  }

  render() {
    const details = this._getDetails(this.props);
    if (!details) {
      return <div>{t`unknown map`}</div>;
    }

    const {
      series,
      className,
      gridSize,
      hovered,
      onHoverChange,
      visualizationIsClickable,
      onVisualizationClick,
      settings,
    } = this.props;
    let { geoJson, minimalBounds } = this.state;

    // special case builtin maps to use legacy choropleth map
    let projection;
    if (settings["map.region"] === "us_states") {
      projection = d3.geo.albersUsa();
    } else if (settings["map.region"] === "world_countries") {
      projection = d3.geo.mercator();
    } else {
      projection = null;
    }

    // const nameProperty = details.region_name;
    const keyProperty = details.region_key;

    if (!geoJson) {
      return (
        <div className={className + " flex layout-centered"}>
          <LoadingSpinner />
        </div>
      );
    }

    const [{ data: { cols } }] = series;
    const rows = this.getFilteredRows();
    const dimensionIndex = _.findIndex(
      cols,
      col => col.name === settings["map.dimension"],
    );
    const metricIndex = _.findIndex(
      cols,
      col => col.name === settings["map.metric"],
    );

    const getRowKey = row =>
      getCanonicalRowKey(row[dimensionIndex], settings["map.region"]);
    const getRowValue = row => row[metricIndex] || 0;

    // const getFeatureName = feature => String(feature.properties[nameProperty]);
    const getFeatureKey = feature =>
      String(feature.properties[keyProperty]).toLowerCase();

    const getFeatureValue = feature => valuesMap[getFeatureKey(feature)];

    const formatMetric = value =>
      formatValue(value, settings.column(cols[metricIndex]));

    const rowByFeatureKey = new Map(rows.map(row => [getRowKey(row), row]));

    const getFeatureClickObject = row => ({
      value: row[metricIndex],
      column: cols[metricIndex],
      dimensions: [
        {
          value: row[dimensionIndex],
          column: cols[dimensionIndex],
        },
      ],
    });

    //let isClickable = true;
    const onClickFeature = click => {
      const row = rowByFeatureKey.get(getFeatureKey(click.feature));
      if (row && this.props.onClick) {
        this.props.onClick({ key: row[dimensionIndex] });
      }
    };

    const onHoverFeature =
      onHoverChange &&
      (hover => {
        const row = hover && rowByFeatureKey.get(getFeatureKey(hover.feature));
        if (row && onHoverChange) {
          onHoverChange({
            ...getFeatureClickObject(row),
            event: hover.event,
          });
        } else if (onHoverChange) {
          onHoverChange(null);
        }
      });

    const valuesMap = {};
    const domain = [];
    for (const row of rows) {
      valuesMap[getRowKey(row)] =
        (valuesMap[getRowKey(row)] || 0) + getRowValue(row);
      domain.push(getRowValue(row));
    }

    const heatMapColors = settings["map.colors"] || HEAT_MAP_COLORS;

    const groups = ss.ckmeans(domain, heatMapColors.length);

    let colorScale = d3.scale
      .quantile()
      .domain(groups.map(cluster => cluster[0]))
      .range(heatMapColors);

    let legendColors = heatMapColors;
    let legendTitles = heatMapColors.map((color, index) => {
      const min = groups[index][0];
      const max = groups[index].slice(-1)[0];
      return index === heatMapColors.length - 1
        ? formatMetric(min) + " +"
        : formatMetric(min) + " - " + formatMetric(max);
    });

    const getColor = feature => {
      let value = getFeatureValue(feature);
      return value == null ? HEAT_MAP_ZERO_COLOR : colorScale(value);
    };

    const getFillOpacity = feature => {
      if (this.props.hasFilter()) {
        const row = rowByFeatureKey.get(getFeatureKey(feature));
        const key = row && row[dimensionIndex];
        return this.props.hasFilter(key) ? 1 : 0.1;
      } else {
        return 1;
      }
    };

    let aspectRatio;
    if (projection) {
      let translate = projection.translate();
      let width = translate[0] * 2;
      let height = translate[1] * 2;
      aspectRatio = width / height;
    } else {
      aspectRatio =
        (minimalBounds.getEast() - minimalBounds.getWest()) /
        (minimalBounds.getNorth() - minimalBounds.getSouth());
    }

    return (
      <ChartWithLegend
        className={className}
        aspectRatio={aspectRatio}
        legendTitles={legendTitles}
        legendColors={legendColors}
        gridSize={gridSize}
        hovered={hovered}
        onHoverChange={onHoverChange}
      >
        {projection ? (
          <LegacyChoropleth
            series={series}
            geoJson={geoJson}
            getColor={getColor}
            onHoverFeature={onHoverFeature}
            onClickFeature={onClickFeature}
            projection={projection}
            getFillOpacity={getFillOpacity}
          />
        ) : (
          <LeafletChoropleth
            series={series}
            geoJson={geoJson}
            getColor={getColor}
            onHoverFeature={onHoverFeature}
            onClickFeature={onClickFeature}
            minimalBounds={minimalBounds}
            getFillOpacity={getFillOpacity}
          />
        )}
        {this.props.hasFilter() && (
          <div
            style={{ position: "absolute", right: "45", cursor: "pointer" }}
            onClick={this.props.filterAll}
          >
            {"RESET"}
          </div>
        )}
      </ChartWithLegend>
    );
  }
}
