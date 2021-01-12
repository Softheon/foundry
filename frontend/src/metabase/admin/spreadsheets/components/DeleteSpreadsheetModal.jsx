import React, { Component } from "react";
import ModalContent from "metabase/components/ModalContent.jsx";
import { t } from "c-3po";
import Button from "metabase/components/Button";


export default class DeleteSpreadsheetModal extends Component {

    constructor(props, context) {
        super(props, context)
        this.state = {
            confirmValue: "",
            error: null
        };
    }

    async deleteSpreadsheet() {
        try {

            this.props.onDelete();
            this.props.onClose();
        } catch (error) {
            this.setState({ error });
        }
    }
    render() {
        const { spreadsheet } = this.props;
        const { confirmValue, error } = this.state;
        let formError;
        if (error) {
            let msg = t`Server error encounter`;
            if (error.data && error.data.message) {
                msg = error.data.message;
            }
            else {
                msg = error.message;
            }
            formError = <span className="text-error px2">{msg}</span>
        }

        let confirmed = confirmValue.toUpperCase() === "DELETE" || confirmValue.toUpperCase() === t`DELETE`;
        const headsUp = <strong>{t`Just a heads up:`}</strong>;
        return (
            <ModalContent
                title={t`Delete this spreadsheet`}
                onClose={this.props.onClose}
            >
                <div className="mb4">
                    <p className="text-paragraph">
                        {t`Its corresponding database table will be lost.`} {" "}
                        <strong>{t`This cannot be undone.`}</strong>
                    </p>
                    <p className="text-paragraph">
                        {t`If you're sure, please type`} <strong>{t`DELETE`}</strong> {""}
                        {t`in this box:`}
                    </p>
                    <input
                        className="Form-input"
                        type="text"
                        onChange={e => this.setState({ confirmValue: e.target.value })}
                        autoFocus
                    />
                </div>
                <div className="ml-auto">
                    <Button onClick={this.props.onClose}>{t`Cancel`}</Button>
                    <Button
                        ml={2}
                        danger
                        disabled={!confirmed}
                        onClick={() => this.deleteSpreadsheet()}
                    >{t`Delete`}</Button>
                    {formError}
                </div>
            </ModalContent>
        );
    }
}