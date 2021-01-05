import React, { Component } from "react";
import { connect } from "react-redux";
import { t } from "c-3po";
import title from "metabase/hoc/Title";
import Breadcrumbs from "metabase/components/Breadcrumbs.jsx";
import SpreadsheetEditForms from "../components/SpreadsheetEditForms";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";

import {
    getEditingSpreadsheet,
    getFormState,
} from "../selectors"

import {
    reset,
    initializeSpreadsheet,
    saveSpreadsheet
} from "../spreadsheet";

const mapStateToProps = (state, props) => ({
    spreadsheet: getEditingSpreadsheet(state),
    formState: getFormState(state)
});

const mapDispatchToProps = {
    reset,
    initializeSpreadsheet,
    saveSpreadsheet

};

@connect(mapStateToProps, mapDispatchToProps)
@title(({ spreadsheet }) => spreadsheet && spreadsheet.name)
export default class SpreadsheetEditApp extends Component {
    constructor(props, context) {
        super(props, context);

    }
    async componentWillMount() {
        await this.props.reset();
        await this.props.initializeSpreadsheet();
    }
    render() {
        let { spreadsheet, formState } = this.props;
        const editingExistingSpreadsheet = spreadsheet && spreadsheet.id != null;
        const addingNewSpreadsheet = !editingExistingSpreadsheet;
        return (
            <div className="wrapper">
                <Breadcrumbs
                    className="py4"
                    crumbs={[
                        [t`Spreadsheets`, "/admin/spreadsheets"],
                        [addingNewSpreadsheet ? t`Add Spreadsheet` : spreadsheet.name]
                    ]}
                />
                <section className="Grid Grid--gutters Grid--2-of-3">
                    <div className="Grid-cell">
                        <div className="Form-new bordered rounded shadowed pt0">
                            <LoadingAndErrorWrapper
                                loading={!spreadsheet}
                                error={null}
                            >
                                <div>
                                    <SpreadsheetEditForms
                                        spreadsheet={spreadsheet}
                                        details={spreadsheet ? spreadsheet.details : null}
                                        formState={formState}
                                        submitFn={
                                            this.props.saveSpreadsheet
                                        }
                                    />
                                </div>
                            </LoadingAndErrorWrapper>
                        </div>

                    </div>
                </section>
            </div>

        );
    }
}