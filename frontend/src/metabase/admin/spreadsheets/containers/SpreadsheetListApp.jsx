import React, { Component } from "react";
import { connect } from "react-redux";
import { t } from "c-3po";
import { Link } from "react-router";
import cx from "classnames";
import ModalWithTrigger from "metabase/components/ModalWithTrigger.jsx";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper.jsx";
import FormMessage from "metabase/components/form/FormMessage";
import DeleteSpreadsheetModal from "../components/DeleteSpreadsheetModal.jsx";
import { getDeletes, getDeletionError, getSpreadsheets, getSortedSheets } from "../selectors";
import { deleteSpreadsheet, fetchSpreadsheets } from "../spreadsheet";

const mapStateToProps = (state, props) => ({
    spreadsheets: getSortedSheets(state, props),
    deletionError: getDeletionError(state),
    deletes: getDeletes(state)
});

const mapDispatchToProps = {
    fetchSpreadsheets,
    deleteSpreadsheet
}

@connect(mapStateToProps, mapDispatchToProps)
export default class SpreadsheetListApp extends Component {
    async componentDidMount() {
        try {
            await Promise.all([
                this.props.fetchSpreadsheets()
            ])
        } catch (error) {
            this.setState({ error })
        }
    }

    render() {

        let { spreadsheets, deletionError, error } = this.props;

        return (
            <LoadingAndErrorWrapper loading={!spreadsheets} error={error}>
                {() => (
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
                                        <th>{t`Type`}</th>
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
                                                        {spreadsheet.name}
                                                    </td>
                                                    <td>
                                                        {spreadsheet.type}
                                                    </td>
                                                    {isDeleting ? (
                                                        <td className="text-right">{t`Deleting...`}</td>
                                                    ) : (
                                                            <td className="Table-actions">
                                                                <DeleteModal
                                                                    spreadsheet={spreadsheet}
                                                                    onDelete={this.props.deleteSpreadsheet}
                                                                />
                                                            </td>
                                                        )}

                                                </tr>
                                            )

                                        })]
                                    ) : null}
                                </tbody>

                            </table>
                        </section>
                    </div>)}

            </LoadingAndErrorWrapper>
        )
    }
}

class DeleteModal extends Component {
    render() {
        const { spreadsheet } = this.props;
        return (
            <ModalWithTrigger
                ref={"deleteSpreadsheetModal"}
                triggerClasses="Button Button--danger"
                triggerElement={t`Delete`}
            >
                <DeleteSpreadsheetModal
                    spreadsheet={spreadsheet}
                    onClose={() => {
                        this.refs.deleteSpreadsheetModal.close();
                    }

                    }
                    onDelete={() => {
                        this.props.onDelete(spreadsheet.id)
                    }}
                />
            </ModalWithTrigger>
        )
    }
}