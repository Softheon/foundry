import { addValidOperatorsToFields } from "metabase/lib/schema_metadata";

import _ from "underscore";

import { MetabaseApi } from "metabase/services";

export function isQueryable(table) {
  return table.visibility_type == null;
}

export function hasFolderName(tableName){
  return tableName.includes("_Profile") ||
  tableName.includes("_Extension") ||
  tableName.includes("_Folder") ||
  tableName.includes("_Task") ||
  tableName.includes("_Flow") ||
  tableName.includes("_File") ||
  tableName.includes("_Note")
}

export function getFolderName (tableName) {
  const idx = tableName.indexOf("_");
  return tableName.substring(0, idx);
}

export function isProfileTable(tableName) {
  return tableName.includes("_Profile");
}

export function isExtensionTable(tableName) {
  return tableName.includes("_Extension");
}

export function isEDW(tableName) {
  return tableName.toUpperCase().endsWith("EDW");
}

export function isFolderRelatedTable(folderName, tableName) {
  return tableName.includes(folderName);
}

export function getFolderChildTableName(tableName, folderName, tableType) {
  let regexString = `^${folderName}_(.*)_${tableType}`
  let regex = new RegExp(regexString);
  let result =  regex.exec(tableName);
  if(result && result.length > 1){
    return result[1].replace("_", " ");
  }
  return null;  
}

export async function loadTableAndForeignKeys(tableId) {
  let [table, foreignKeys] = await Promise.all([
    MetabaseApi.table_query_metadata({ tableId }),
    MetabaseApi.table_fks({ tableId }),
  ]);

  await augmentTable(table);

  return {
    table,
    foreignKeys,
  };
}

export async function augmentTable(table) {
  table = populateQueryOptions(table);
  table = await loadForeignKeyTables(table);
  return table;
}

export function augmentDatabase(database) {
  database.tables_lookup = createLookupByProperty(database.tables, "id");
  for (let table of database.tables) {
    addValidOperatorsToFields(table);
    table.fields_lookup = createLookupByProperty(table.fields, "id");
    for (let field of table.fields) {
      addFkTargets(field, database.tables_lookup);
      field.operators_lookup = createLookupByProperty(field.operators, "name");
    }
  }
  return database;
}

async function loadForeignKeyTables(table) {
  // Load joinable tables
  await Promise.all(
    table.fields.filter(f => f.target != null).map(async field => {
      let targetTable = await MetabaseApi.table_query_metadata({
        tableId: field.target.table_id,
      });
      field.target.table = populateQueryOptions(targetTable);
    }),
  );
  return table;
}

function populateQueryOptions(table) {
  table = addValidOperatorsToFields(table);

  table.fields_lookup = {};

  _.each(table.fields, function(field) {
    table.fields_lookup[field.id] = field;
    field.operators_lookup = {};
    _.each(field.operators, function(operator) {
      field.operators_lookup[operator.name] = operator;
    });
  });

  return table;
}

function addFkTargets(field, tables) {
  if (field.target != null) {
    field.target.table = tables[field.target.table_id];
  }
}

export function createLookupByProperty(items, property) {
  return items.reduce((lookup, item) => {
    lookup[item[property]] = item;
    return lookup;
  }, {});
}
