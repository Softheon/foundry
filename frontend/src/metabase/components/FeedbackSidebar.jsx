import React, { Component } from "react";
import "metabase/css/components/sidetab.css";
import Settings from "metabase/lib/settings";

export default class FeedbackSidebar extends Component {
    constructor (props) {
        super(props);
    }

    render() {
      const ligthouseUrl = Settings.ligthouseUrl();
      const text = ligthouseUrl ? "Report an Issue" : "Provide Feedback";
      return (
            <a className ="sidetab fast"
                href={ligthouseUrl ? ligthouseUrl: "https://www.surveymonkey.com/r/Foundry_feedback"}
                target="_blank"
                style={{ bottom: 80, right: -35}}
                title={text}
                >
            {text}
            </a>
        )
    }
}
