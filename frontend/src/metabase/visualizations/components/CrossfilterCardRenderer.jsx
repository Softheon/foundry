/* @flow */

import React, { Component } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import crossfilter from "crossfilter";
import _ from "underscore";
import ExplicitSize from "metabase/components/ExplicitSize.jsx";

import { isSameSeries } from "metabase/visualizations/lib/utils";

import type { VisualizationProps } from "metabase/meta/types/Visualization";

type DeregisterFunction = () => void;

type Props = VisualizationProps & {
  renderer: (element: Element, props: VisualizationProps) => DeregisterFunction,
};

@ExplicitSize()
export default class CrossfilterCardRenderer extends Component {
  props: Props;

  static propTypes = {
    className: PropTypes.string,
    series: PropTypes.array.isRequired,
    renderer: PropTypes.func.isRequired,
    onRenderError: PropTypes.func.isRequired,
  };

  _deregister: ?DeregisterFunction;

  constructor(props) {
    super(props);
    // Initialize chart's crossfilter.
    const { isCrossfilterSource } = this.props;
    const { rawSeries, settings } = this.props;
    const [{ data: { cols, rows } }] = rawSeries;
    const dimensions = settings["graph.dimensions"].filter(d => d != null);
    const metrics = settings["graph.metrics"].filter(d => d != null);
    const dimensionColumnIndexes = dimensions.map(dimensionName =>
      _.findIndex(cols, col => col.name === dimensionName),
    );
    const metricColumnIndexes = metrics.map(metricName =>
      _.findIndex(cols, col => col.name === metricName),
    );
    const dimensionColumnIndex = dimensionColumnIndexes[0];
    const metricColumnIndex = metricColumnIndexes[0];

    let dataset = null;
    if (isCrossfilterSource) {
      dataset = crossfilter(rows);
    } else {
      dataset = this.props.getSourceCrossfilter();
    }
    let dimension;
    let group;
    const { bubbleColumnIndex } = this.props;
    if (this.props.chartDisplayType === "scatter") {
      dimension = dataset.dimension(d => {
        let data = [d[dimensionColumnIndex], d[metricColumnIndex]];
        if (bubbleColumnIndex) {
          data.push(d[bubbleColumnIndex]);
        }
        data._origin = {
          seriesIndex: 1,
          row: d,
          cols: cols,
        };
        return data;
      });

      group = dimension.group().reduceSum(d => d[bubbleColumnIndex] || 1);
    } else {
      dimension = dataset.dimension(d => d[dimensionColumnIndex]);
      group = dimension.group().reduceSum(d => d[metricColumnIndex]);
    }

    if (isCrossfilterSource) {
      this.props.addSourceCrossfilter({
        crossfilter: dataset,
        dimension,
        group,
        dimensionIndex: dimensionColumnIndex,
        metricIndex: metricColumnIndex,
      });
    } else {
      this.props.setDimension(dimension);
      this.props.setGroup(group);
    }
  }

  shouldComponentUpdate(nextProps: Props) {
    if (nextProps.resetedCrossfilterId === this.props.crossfilterGroup) {
      this._resetChart();
    } 
    if (nextProps.resetedCrossfilterId !== this.props.resetedCrossfilterId &&
      this.props.resetedCrossfilterId === this.props.crossfilterGroup ) {
      this._redraw();
    } 
    else if (
      this._redraw &&
      nextProps.activeCrossfilterGroup === this.props.crossfilterGroup
    ) {
      this._redraw();
    }

    let sameSize =
      this.props.width === nextProps.width &&
      this.props.height === nextProps.height;
    let sameSeries = isSameSeries(this.props.series, nextProps.series);
    return !(sameSize && sameSeries);
  }

  componentDidMount() {
    this.renderChart();
    const { isCrossfilterSource } = this.props;
    if (isCrossfilterSource) {
      this.props.redrawCrossfilterGroup();
    }
  }

  componentDidUpdate() {
    this.renderChart();
  }

  componentWillUnmount() {
    this._deregisterChart();
  }

  _deregisterChart() {
    if (this._deregister) {
      // Prevents memory leak
      this._deregister();
      delete this._deregister;
    }
  }

  renderChart() {
    if (this.props.width == null || this.props.height == null) {
      return;
    }

    let parent = ReactDOM.findDOMNode(this);

    // deregister previous chart:
    this._deregisterChart();

    // reset the DOM:
    let element = parent.firstChild;
    if (element) {
      parent.removeChild(element);
    }

    // create a new container element
    element = document.createElement("div");
    parent.appendChild(element);

    try {
      const result = this.props.renderer(element, this.props);
      this._deregister = result.deregister;
      this._redraw = result.redraw;
      this._resetChart = result.resetFilter;
    } catch (err) {
      console.error(err);
      this.props.onRenderError(err.message || err);
    }
  }

  render() {
    return <div className={this.props.className} />;
  }
}
