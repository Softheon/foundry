import {createSelector} from "reselect";
import _ from "underscore";

// Spreadsheet Edit
export const getEditingSpreadsheet = state => state.admin.spreadsheets.editingSpreadsheet;
export const getFormState= state => state.admin.spreadsheets.formState;

// Spreadsheet List
export const getDeletes = state => state.admin.spreadsheets.deletes;
export const getDeletionError = state => state.admin.spreadsheets.deletionError; 
export const getSpreadsheets = state => state.admin.spreadsheets.sheets;

export const getSortedSheets = createSelector(
    [getSpreadsheets],
    sheets => {
        return sheets &&_.values(sheets).sort((a,b) => b.id - a.id);
    }
)