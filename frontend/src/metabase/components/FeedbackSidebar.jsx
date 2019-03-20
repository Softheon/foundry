import React, { Component } from "react";
import "metabase/css/components/sidetab.css";

export default class FeedbackSidebar extends Component {
    constructor (props) {
        super(props);
    }
    render() {
        return (
            <a className ="sidetab fast" 
                href="https://www.surveymonkey.com/r/Foundry_feedback" 
                target="_blank" 
                style={{ bottom: 80, right: -48}}
                title="Tell Us what you think!"
                >
            Provide Feedback    
            </a>
        )
    }
}