import React, { Component } from "react";
import { t } from "c-3po";
import FormField from "metabase/components/form/FormField.jsx";
import FormLabel from "metabase/components/form/FormLabel.jsx";
import FormMessage from "metabase/components/form/FormMessage.jsx";
import { shallowEqual } from "recompose";
import cx from "classnames";

const FIELDS = [
    {
        name: "name",
        "display-name": t`Name`,
        placeholder: t`How would you like to refer to this spreadsheet?`,
        required: true,
    },
    {
        name: "file",
        "display-name": t`File`,
        placeholder: t`The spreadsheet to import`,
        required: true,
        type: "file"
    },
    {
        name: "host",
        "display-name": t`Host`,
        placeholder: t`localhost`,
        required: true,
    },
    {
        name: "port",
        "display-name": t`Port`,
        placeholder: t`5432`,
        required: true
    },
    {
        name: "db",
        "display-name": t`Database name`,
        placeholder: t`To which database would you like to import the spreadsheet?`,
        required: true
    },
    {
        name: "instance",
        "display-name": t`Database instance name`,
        placeholder: t`what is the database instance name?`,
        required: true,
    },
    {
        name: "user",
        "display-name": t`Database username`,
        placeholder: t`what username do you use to login to the database?`,
        required: true,
    },
    {
        name: "password",
        "display-name": t`Database password`,
        placeholder: t`******`,
        type: "password",
        required: true,
    }]
function isEmpty(str) {
    return !str || 0 === str.length;
}
export default class SpreadsheetEditForms extends Component {

    constructor(props, context) {
        super(props, context);
        this.state = {
            details: props.details || {},
            valid: false,
            type: "csv"
        }
    }

    componentWillReceiveProps(nextProps) {
        if (!shallowEqual(this.props.details, nextProps.details)) {
            this.setState({ details: nextProps.details });
        }
    }

    componentDidMount() {
        this.validateForm();
    }

    componentDidUpdate() {
        this.validateForm();
        console.log("current state ", this.state);
    }


    formSubmitted = e => {
        e.preventDefault();
        const { details, type } = this.state;
        let request = {
            name: details.name,
            details: {},
            type
        }
        for (let field of FIELDS) {
            const fieldValue = details[field.name];
            let val = !fieldValue || fieldValue === "" ? null : fieldValue;
            if (val && field.type === "integer") {
                val = parseInt(val);
            }
            if (val == null && field.default) {
                val = field.default;
            }
            request.details[field.name] = val;
        }
        let { submitFn } = this.props;
        submitFn(request);
    };

    validateForm() {
        const { details, type } = this.state;
        let valid = true;
        if (!details.name || !type) {
            valid = false;
        }

        for (let field of FIELDS) {
            if (field.required &&
                (field.name === "file" && !details[field.name]
                    || isEmpty(details[field.name]))) {
                valid = false;
                break;

            }
        }
        if (this.state.valid !== valid) {
            this.setState({ valid });
        }

    }

    onChange(fieldName, fieldValue) {
        this.setState({
            details: { ...this.state.details, [fieldName]: fieldValue }
        })
    }

    renderField(field, fieldIndex) {
        return (
            <FormField key={field.name} fieldName={field.name}>
                <FormLabel title={field["display-name"]} fieldName={field.name} />
                {this.renderFieldInput(field, fieldIndex)}
                <span className="Form-charm" />
            </FormField>
        )
    }

    renderFieldInput(field, fieldIndex) {
        const { details } = this.state;
        const value = (details && details[field.name]) || "";
        switch (field.type) {
            case "file":
                return (

                    <input
                        type="file"
                        className="Form-input Form-offset full"
                        accept=".csv,.xlsx"
                        ref={field.name}
                        name={field.name}
                        onChange={e => this.onChange(field.name, e.target.files[0])}
                        required={field.required}
                    />
                )
            default:
                return (
                    <input
                        type={field.type === "password" ? "password" : "text"}
                        className="Form-input Form-offset full"
                        ref={field.name}
                        name={field.name}
                        value={value}
                        placeholder={field.default || field.placeholder}
                        onChange={(e => this.onChange(field.name, e.target.value))}
                        required={field.required}
                        autoFocus={fieldIndex === 0}
                    />
                )
        }
    }

    render() {
        let {
            spreadsheet,
            formState: { formError, formSuccess, isSubmitting }
        } = this.props;

        let { valid } = this.state;
        return (
            <div className="mt4">
                <div className="Form-field">
                    <label className="Form-label Form-offset">
                        Spreadsheet type:
                    </label>
                    <label className="Select Form-offset mt1">
                        <select
                            className="Select"
                            defaultValue={"csv"}
                            onChange={e => this.setState({ type: e.target.value })}
                        >
                            <option value="" disabled>{t`Select a spreadsheet type`}</option>
                            <option value="csv">{t`CSV`}</option>
                            <option value="xlsx">{t`XLSX`}</option>
                        </select>
                    </label>
                </div>
                <form onSubmit={this.formSubmitted} noValidate>
                    <div className="FormInputGroup pb2">
                        {FIELDS.map((field, fieldIndex) => this.renderField(field, fieldIndex))}
                    </div>
                    <div className="Form-actions">
                        <button
                            className={cx("Button", { "Button--primary": valid })}
                            disabled={!valid || isSubmitting}
                        >
                            {isSubmitting
                                ? t`Saving...`
                                : t`Save`}
                        </button>
                        <FormMessage formError={formError} formSuccess={formSuccess} />
                    </div>
                </form>
            </div>
        )
    }
}