import React, { Component } from "react";
import { connect } from "react-redux";
import crossfilter from "crossfilter";

/**
 * this contains some state for dashboard crossfilter controls on both private and embedded
 * dashboards.
 */

export default ComposedComponent =>
  connect(null, null)(
    class extends Component {
      static displayName = "DashboardCrossFilterControls[" +
        (ComponsedCompnent.displayName || ComponsedCompnent.name) +
        "]";
        componentWillMount() {
            this.initializeCrossfilters();
        }
        componentWillUnmount() {}
        componentDidUpdate() {
            this.updateCrossfilters();
        }

        initializeCrossfilters () {

        }
    
        updateCrossfilters(){

        }
        render () {
            return (
                <ComposedComponent
                 {...this.props}
                 {...this.state}
            />
            )
        }
    },
  );
