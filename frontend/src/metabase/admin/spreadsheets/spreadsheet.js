import { createAction } from "redux-actions";

import {
    handleActions,
    combineReducers,
    createThunkAction,
    momentifyObjectsTimestamps
} from "metabase/lib/redux";

import { MetabaseApi } from "metabase/services";
import { t } from "c-3po";

import Spreadsheets from "metabase/entities/spreadsheets.js";
import { push } from "react-router-redux";
import _ from "underscore";

import { SpreadsheetApi } from "metabase/services";
import { normalize, schema } from "normalizr";

export const RESET = "foundry/admin/spreadsheets/RESET";

export const SELECT_SPREADSHEET_TYPE = "csv"

export const FETCH_SPREADSHEETS = "foundry/admin/spreadsheets/FETCH_SPREADSHEETS";

export const INITIALIZE_SPREADSHEET = "foundry/admin/spreadsheets/INITIALIZE_SPREADSHEET";

export const CREATE_SPREADSHEET = "foundry/admin/spreadsheets/CREATE_SPREADSHEET";
export const CREATE_SPREADSHEET_STARTED = "foundry/admin/spreadsheets/CREATE_SPREADSHEET_STARTED";
export const CREATE_SPREADSHEET_FAILED = "foundry/admin/spreadsheets/CREATE_SPREADSHEET_FAILED";

export const DELETE_SPREADSHEET = "foundry/admin/spreadsheets/DELETE_SPREADSHEET";
export const DELETE_SPREADSHEET_STARTED = "foundry/admin/spreadsheets/DELETE_SPREADSHEET_STARTED";
export const DELETE_SPREADSHEET_FAILED = "foundry/admin/spreadsheets/DELETE_SPREADSHEET_FAILED";

export const UPDATE_SPREADSHEET = "foundry/admin/spreadsheets/UPDATE_SPREADSHEET";
export const UPDATE_SPREADSHEET_STARTED = "foundry/admin/spreadsheets/UPDATE_SPREADSHEET_STARTED";
export const UPDATE_SPREADSHEET_FAILED = "foundry/admin/spreadsheets/UPDATE_SPREADSHEET_FAILED";

export const CLEAR_FORM_STATE = "foundry/admin/spreadsheets/CLEAR_FORM_STATE";

export const reset = createAction(RESET);


export const initializeSpreadsheet = function (id) {
    return async function (dispatch, getState) {
        if (id) {
            try {
                const sheet = await MetabaseApi.fetchSpreadsheet({ id });
                dispatch.action(INITIALIZE_SPREADSHEET, sheet);
            } catch (error) {
                console.error("error fetching spreadsheet", id, error);
            }
        }
        else {
            return dispatch.action(INITIALIZE_SPREADSHEET, {
                name: "",
                type: "csv",
                details: {},
                created: false
            })
        }
    }
}

export const saveSpreadsheet = spreadsheet => async (dispatch, getState) => {
    dispatch.action(CREATE_SPREADSHEET_STARTED, {});
    // const action = await dispatch(Spreadsheets.actions.create(spreadsheet));
    const formData = new FormData();
    formData.append("type", spreadsheet.type);
    Object.keys(spreadsheet.details).map(key => formData.append(key, spreadsheet.details[key]));
    const basename = window.MetabaseRoot.replace(/\/+$/, "");
    fetch(basename + "/api/spreadsheet", {
        method: 'POST',
        body: formData
    }).then(
        response => {
            if (!response.ok) {
                throw response;
            }
            else {
                dispatch.action(CREATE_SPREADSHEET);
                dispatch(push("/admin/spreadsheets"));
            }
        }
    ).catch(error => {
        error.json().then(body => {
            console.error("error saving spreadsheet", body);
            dispatch.action(CREATE_SPREADSHEET_FAILED,
                {
                    error: {
                        data: {
                            message: body.message
                        }
                    }
                }
            );
        })
    })
}

const spreadsheet = new schema.Entity("spreadsheet");
export const fetchSpreadsheets = createThunkAction(FETCH_SPREADSHEETS, () => async () => {
    const spreadsheets = await SpreadsheetApi.list();
    return normalize(spreadsheets, [spreadsheet])
})


export const deleteSpreadsheet = spreadsheetId => async (dispatch, getState) => {
    try {
        dispatch.action(DELETE_SPREADSHEET_STARTED, { spreadsheetId });
        dispatch(push("/admin/spreadsheets"));
        await SpreadsheetApi.delete({ id: spreadsheetId });
        dispatch.action(DELETE_SPREADSHEET, { spreadsheetId });
    } catch (error) {
        console.error("error deleting spreadsheet", error);
        dispatch.action(DELETE_SPREADSHEET_FAILED, { spreadsheetId, error });
    }
}

// Reducers
const editingSpreadsheet = handleActions({
    [RESET]: () => null,
    [INITIALIZE_SPREADSHEET]: (state, { payload }) => payload,
    [UPDATE_SPREADSHEET]: (state, { payload }) => null,
    [DELETE_SPREADSHEET]: (state, { payload }) => null,
    [SELECT_SPREADSHEET_TYPE]: (state, { payload }) => ({ ...state, type: payload })

}, null);


const deletes = handleActions({
    [DELETE_SPREADSHEET_STARTED]: (state, { payload: { spreadsheetId } }) =>
        state.concat([spreadsheetId]),
    [DELETE_SPREADSHEET_FAILED]: (state, { payload: { spreadsheetId, error } }) =>
        state.filter(id => id !== spreadsheetId),
    [DELETE_SPREADSHEET]: (state, { payload: { spreadsheetId } }) =>
        state.filter(id => id !== spreadsheetId),
}, []);

const deletionError = handleActions({
    [DELETE_SPREADSHEET_FAILED]: (state, { payload: { error } }) => error,
}, null);

const DEFAULT_FORM_STATE = {
    formSuccess: null,
    formError: null,
    isSubmitting: false
};
const formState = handleActions({
    [RESET]: { next: () => DEFAULT_FORM_STATE },
    [CREATE_SPREADSHEET_STARTED]: () => ({
        isSubmitting: true
    }),
    [CREATE_SPREADSHEET]: () => ({
        formSuccess: { data: { message: t`Successfully saved` } }
    }),
    [CREATE_SPREADSHEET_FAILED]: (state, { payload: { error } }) => ({
        formError: error
    }),
    [CLEAR_FORM_STATE]: () => DEFAULT_FORM_STATE
}, DEFAULT_FORM_STATE);


const sheets = handleActions({
    [FETCH_SPREADSHEETS]: {
        next: (state, { payload }) =>
            momentifyObjectsTimestamps(payload.entities.spreadsheet, ["created_at", "updated_at"]),
    },
    [DELETE_SPREADSHEET]: {
        next: (state, { payload: { spreadsheetId } }) =>
            _.omit(state, spreadsheetId)
    }
}, null);

export default combineReducers({
    editingSpreadsheet,
    deletionError,
    formState,
    deletes,
    sheets
})