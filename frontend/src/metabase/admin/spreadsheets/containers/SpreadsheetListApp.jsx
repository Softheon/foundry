import React, { Component } from "react";

import { connect } from "react-redux";
import { t } from "c-3po";
import { Link } from "react-router";
import cx from "classnames";

import ModalWithTrigger from "metabase/components/ModalWithTrigger.jsx";
import LoadingSpinner from "metabase/components/LoadingSpinner.jsx";
import FormMessage from "metabase/components/form/FormMessage";
import DeleteSpreadsheetModal from "../components/DeleteSpreadsheetModal.jsx";

//import CreatedSpread

const mapStateToProps = (state, props) => ({

    deletionError: () => null,
    deletes: () => null
});

const mapDispatchToProps = {
    fetchSpreadsheets: () => null,
    deleteSpreadsheet: () => null
}

@connect(mapStateToProps, mapDispatchToProps)
export default class SpreadsheetListApp extends Component {
    render() {
        let { spreadsheets, deletionError } = this.props;

        return (
            <div className="wrapper">
                <section className="PageHeader px2 clearfix">
                    <Link
                        to="/admin/spreadsheets/create"
                        className="Button Button--primary float-right"
                    >
                        {t`Add spreadsheet`}
                    </Link>
                    <h2 className="PageTitle">{t`Spreadsheets`}</h2>
                </section>
                {deletionError && (
                    <section>
                        <FormMessage formError={deletionError} />
                    </section>
                )}
                <section>
                    <table className="ContentTable">
                        <thead>
                            <tr>
                                <th> {t`Name`}</th>
                                <th>{t`Database`}</th>
                                <th>{t`Status`}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {spreadsheets ? (
                                [spreadsheets.map(spreadsheet => {
                                    const isDeleting = this.props.deletes.indexOf(spreadsheet.id) !== -1;
                                    return (
                                        <tr
                                            key={spreadsheet.id}
                                            className={cx({ disabled: isDeleting })}
                                        >
                                            <td>
                                                <Link
                                                    to={"/admin/spreadsheets/" + spreadsheet.id}
                                                    className="text-bold link"
                                                >
                                                    {spreadsheet.name}
                                                </Link>
                                            </td>
                                            <td>
                                                {spreadsheet.database.name || "database"}
                                            </td>
                                            <td>
                                                {spreadsheet.status}
                                            </td>
                                            {isDeleting ? (
                                                <td className="text-right">{t`Deleting...`}</td>
                                            ) : (
                                                    <td className="Table-actions">
                                                        <ModalWithTrigger
                                                            ref={"deleteSpreadsheetModal_" + spreadsheet.id}
                                                            triggerClasses="Button Button--danger"
                                                            triggerElement={t`Delete`}
                                                        >
                                                            <DeleteSpreadsheetModal
                                                                spreadsheet={spreadsheet}
                                                                onClose={() => {
                                                                    this.refs[
                                                                        "deleteSpreadsheetModal_" + spreadsheet.id
                                                                    ].closest()
                                                                }}
                                                                onDelete={() => {
                                                                    this.props.deleteSpreadsheet(spreadsheet.id)
                                                                }}
                                                            />
                                                        </ModalWithTrigger>
                                                    </td>
                                                )}

                                        </tr>
                                    )

                                })]
                            ) : null}
                        </tbody>

                    </table>
                </section>
            </div>
        )
    }
}