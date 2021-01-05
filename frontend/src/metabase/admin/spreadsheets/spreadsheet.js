import { createAction } from "redux-actions";

import {
    handleActions,
    combineReducers,
    createThunkAction
} from "metabase/lib/redux";

import { MetabaseApi } from "metabase/services";
import { t } from "c-3po";

import Spreadsheets from "metabase/entities/spreadsheets";
import { push } from "react-router-redux";

export const RESET = "foundry/admin/spreadsheets/RESET";

export const SELECT_SPREADSHEET_TYPE = "csv"

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
    try {
        dispatch.action(CREATE_SPREADSHEET_STARTED, {});
        const action = await dispatch(Spreadsheets.actions.create(spreadsheet));
        // const createdSpreadsheet=Spreadsheets.HACK_getObjectFromAction(action);
        dispatch.action(CREATE_SPREADSHEET);
        dispatch(push("/admin/spreadsheets"));

    } catch (error) {
        console.error("error saving spreadsheet", error);
        dispatch.action(CREATE_SPREADSHEET_FAILED, { error });
    }
}

// export const saveSpreadsheet = request => async (dispatch, getState) => {
//     dispatch()
// }

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
    [DELETE_SPREADSHEET]: (state, { payload: { error } }) => error,
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
        formError: error }),
    [CLEAR_FORM_STATE]: () => DEFAULT_FORM_STATE
}, DEFAULT_FORM_STATE);


export default combineReducers({
    editingSpreadsheet,
    deletionError,
    formState,
    deletes
})