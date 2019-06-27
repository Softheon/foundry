import React, { Component } from "react";
import d3 from "d3";
import styles from "../visualizations/PieChart.css";
import ExplicitSize from "metabase/components/ExplicitSize.jsx";

const OUTER_RADIUS = 50; // within 100px canvas
const INNER_RADIUS_RATIO = 3 / 5;

const PAD_ANGLE = Math.PI / 180 * 1; // 1 degree in radians
const SLICE_THRESHOLD = 0.025; // approx 1 degree in percentage
const OTHER_SLICE_MIN_PERCENTAGE = 0.003;
const SLICE_CLASS = "pie-slice";

function buildArc() {
  return d3.svg
    .arc()
    .outerRadius(OUTER_RADIUS)
    .innerRadius(OUTER_RADIUS * INNER_RADIUS_RATIO);
}

function buildPieLayout() {
  return d3.layout
    .pie()
    .sort(null)
    .padAngle(PAD_ANGLE)
    .value(d => d.value);
}

function safeArc(d, i, arc) {
  const path = arc(d, i);
  if (path.indexOf("NaN") >= 0) {
    return "M0,0";
  }
  return path;
}

function isOffCanvas(current) {
  return !current || isNaN(current.startAngle) || isNaN(current.endAngle);
}

function tweenPie(d, i, a) {
  d.innerRadius = OUTER_RADIUS * INNER_RADIUS_RATIO;
  let current = this._current;
  if (isOffCanvas(current)) {
    current = {
      startAngle: 0,
      endAngle: 0,
    };
  } else {
    current = { startAngle: current.startAngle, endAngle: current.endAngle };
  }
  const interp = d3.interpolate(current, d);
  this._current = interp(0);
  return t => {
    return safeArc(interp(t), 0, buildArc());
  };
}

function createSliceNodes(slices) {
  return slices
    .enter()
    .append("g")
    .attr("class", (d, i) => {
      return SLICE_CLASS + " _" + i;
    });
}

function createSlicePaths(slices, arc, chartProps) {
  const slicePath = slices
    .append("path")
    .attr("fill", (d, i) => {
      return d.data.color;
    })
    .on("click", (d, i) => {
      if (d.data.key === 'Other') {
        return;
      }
      chartProps.onClick(d.data);
    })
    .on("mousemove", (d, i) => {
      chartProps.onMouseMove(i, d3.event);
    })
    .on("mouseleave", (d, i) => {
      chartProps.onMouseLeave();
    })
    .attr("d", (d, i) => {
      return safeArc(d, i, arc);
    });
  const slicePathTransition = slicePath.transition();
  slicePathTransition.duration(750).delay(0);
  if (slicePathTransition.attrTween) {
    slicePathTransition.attrTween("d", tweenPie);
  }
}

function updateSlicePaths(sliceGroup, pieData, arc, chartProps) {
  const slicePath = sliceGroup
    .selectAll("g")
    .data(pieData)
    .select("path")
    .attr("d", (d, i) => {
      return safeArc(d, i, arc);
    });
  const slicePathTransition = slicePath.transition();
  slicePathTransition.duration(750).delay(0);
  if (slicePathTransition.attrTween) {
    slicePathTransition.attrTween("d", tweenPie);
  }
  slicePathTransition.attr("fill", (d, i) => {
    return d.data.color;
  });
}

function removeElements(slices, chartProps) {
  slices.exit().remove();
}

function createElements(slices, arc, pieData, chartProps) {
  const newSlices = createSliceNodes(slices, chartProps);
  createSlicePaths(newSlices, arc, chartProps);
}

function updateElements(sliceGroup, pieData, arc, chartProps) {
  updateSlicePaths(sliceGroup, pieData, arc, chartProps);
}

function highlightFilter(sliceGroup, chartProps) {
  if (chartProps.hasFilter()) {
    sliceGroup.selectAll("g." + SLICE_CLASS).each(function(d) {
      if (chartProps.hasFilter(d.data.key)) {
        chartProps.highlightSelected(this);
      } else {
        chartProps.fadeDeselected(this);
      }
    });
  } else {
    sliceGroup.selectAll("g." + SLICE_CLASS).each(function() {
      chartProps.resetHighlight(this);
    });
  }
}

function drawChart(sliceGroup, data, chartProps) {
  const arc = buildArc();
  const pie = buildPieLayout();
  const pieData = pie(data);
  console.log("xia: pieData", pieData);
  const slices = sliceGroup.selectAll("g").data(pieData);
  removeElements(slices);
  createElements(slices, arc, pieData, chartProps);
  updateElements(sliceGroup, pieData, arc);
  highlightFilter(sliceGroup, chartProps);
}

export default class CrossfilterPie extends Component {
  constructor(props) {
    super(props);
    this.chartProps = {
      onClick: this.props.onClick,
      onMouseMove: this.props.onMouseMove,
      onMouseLeave: this.props.onMouseLeave,
      hasFilter: this.props.hasFilter,
      isSelectedSlice: this.isSelectedSlice,
      highlightSelected: this.props.highlightSelected,
      fadeDeselected: this.props.fadeDeselected,
      resetHighlight: this.props.resetHighlight,
    };
  }

  componentDidMount() {
    const group = d3.select(this.refs.group);
    drawChart(group, this.props.data, this.chartProps);
  }

  componentDidUpdate() {
    const group = d3.select(this.refs.group);
    drawChart(group, this.props.data, this.chartProps);
  }
  render() {
    return (
      <svg className={styles.Donut + " m1"} viewBox="0 0 100 100">
        <g ref="group" transform={`translate(50,50)`} />
      </svg>
    );
  }
}
