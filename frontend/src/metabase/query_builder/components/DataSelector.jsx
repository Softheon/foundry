import React, { Component } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { t } from "c-3po";
import cx from "classnames";
import Icon from "metabase/components/Icon.jsx";
import PopoverWithTrigger from "metabase/components/PopoverWithTrigger.jsx";
import AccordianList from "metabase/components/AccordianList.jsx";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";

import { 
  isQueryable, 
  isEDW, 
  hasFolderName, 
  getFolderChildTableName, 
  getFolderName, 
  isProfileTable, 
  isExtensionTable,
  isFolderRelatedTable } from "metabase/lib/table";
  
import { titleize, humanize } from "metabase/lib/formatting";

import { fetchTableMetadata } from "metabase/redux/metadata";
import { getMetadata } from "metabase/selectors/metadata";

import _ from "underscore";

// chooses a database
const DATABASE_STEP = "DATABASE";
// chooses a database and a schema inside that database
const DATABASE_SCHEMA_STEP = "DATABASE_SCHEMA";
// chooses a schema (given that a database has already been selected)
const SCHEMA_STEP = "SCHEMA";
// chooses a database and a schema and provides additional "Segments" option for jumping to SEGMENT_STEP
const SCHEMA_AND_SEGMENTS_STEP = "SCHEMA_AND_SEGMENTS";
// chooses a table (database has already been selected)
const TABLE_STEP = "TABLE";
// chooses a table field (table has already been selected)
const FIELD_STEP = "FIELD";
// shows either table or segment list depending on which one is selected
const SEGMENT_OR_TABLE_STEP = "SEGMENT_OR_TABLE_STEP";


const DATABASE_FOLDER_STEP = "DATABASE_FOLDER"
const PROFILE_STEP = "PROFILE";
const PROFILE_TABLE_STEP = "PROFILE_TABLE";
const EDW_TABLE_STEP = "EDW_TABLE";
const EVERYTHING_ELSE ="other";
const FOLDER_TYPE = "folder";
const PROFILE_TYPE = "profile";
const EXTENSION_TYPE = "extension";
const TABLE_TYPE = "table";
const OTHER_TYPE = "other";
const EXTENSION_TYPE_LABEL = "Extension Tables";
const PROFILE_TABLE_KEY = "Profile";
const EXTENSION_TABLE_KEY = "Extension";
const EVERYTHING_ELSE_FOLDER = "Everything Else";

export const SchemaTableAndSegmentDataSelector = props => (
  <DataSelector
    steps={[SCHEMA_AND_SEGMENTS_STEP, SEGMENT_OR_TABLE_STEP]}
    getTriggerElementContent={SchemaAndSegmentTriggerContent}
    {...props}
  />
);
export const SchemaAndSegmentTriggerContent = ({
  selectedTable,
  selectedSegment,
}) => {
  if (selectedTable) {
    return (
      <span className="text-grey no-decoration">
        {selectedTable.display_name || selectedTable.name}
      </span>
    );
  } else if (selectedSegment) {
    return (
      <span className="text-grey no-decoration">{selectedSegment.name}</span>
    );
  } else {
    return (
      <span className="text-medium no-decoration">{t`Pick a segment or table`}</span>
    );
  }
};

export const DatabaseDataSelector = props => (
  <DataSelector
    steps={[DATABASE_STEP]}
    getTriggerElementContent={DatabaseTriggerContent}
    {...props}
  />
);
export const DatabaseTriggerContent = ({ selectedDatabase }) =>
  selectedDatabase ? (
    <span className="text-grey no-decoration">{selectedDatabase.name}</span>
  ) : (
    <span className="text-medium no-decoration">{t`Select a database`}</span>
  );

export const SchemaTableAndFieldDataSelector = props => (
  <DataSelector
    steps={[SCHEMA_STEP, TABLE_STEP, FIELD_STEP]}
    getTriggerElementContent={FieldTriggerContent}
    triggerIconSize={12}
    renderAsSelect={true}
    {...props}
  />
);
export const FieldTriggerContent = ({ selectedDatabase, selectedField }) => {
  if (!selectedField || !selectedField.table) {
    return (
      <span className="flex-full text-medium no-decoration">{t`Select...`}</span>
    );
  } else {
    const hasMultipleSchemas =
      selectedDatabase &&
      _.uniq(selectedDatabase.tables, t => t.schema).length > 1;
    return (
      <div className="flex-full cursor-pointer">
        <div className="h6 text-bold text-uppercase text-light">
          {hasMultipleSchemas && selectedField.table.schema + " > "}
          {selectedField.table.display_name}
        </div>
        <div className="h4 text-bold text-default">
          {selectedField.display_name}
        </div>
      </div>
    );
  }
};

export const DatabaseSchemaAndTableDataSelector = props => (
  <DataSelector
    steps={[DATABASE_SCHEMA_STEP, TABLE_STEP]}
    getTriggerElementContent={TableTriggerContent}
    {...props}
  />
);

export const DatabaseFolderProfileExtensionDataSelector = props => (
  <DataSelector 
  steps={[DATABASE_FOLDER_STEP, PROFILE_STEP, PROFILE_TABLE_STEP, EDW_TABLE_STEP]}
  getTriggerElementContent={TableTriggerContent}
  {...props}
  />
);

export const SchemaAndTableDataSelector = props => (
  <DataSelector
    steps={[SCHEMA_STEP, TABLE_STEP]}
    getTriggerElementContent={TableTriggerContent}
    {...props}
  />
);
export const TableTriggerContent = ({ selectedTable }) =>
  selectedTable ? (
    <span className="text-grey no-decoration">
      {selectedTable.display_name || selectedTable.name}
    </span>
  ) : (
    <span className="text-medium no-decoration">{t`Select a table`}</span>
  );

@connect(state => ({ metadata: getMetadata(state) }), { fetchTableMetadata })
export default class DataSelector extends Component {
  constructor(props) {
    super();

    this.state = {
      ...this.getStepsAndSelectedEntities(props),
      activeStep: null,
      isLoading: false,
    };
  }

  getFolderNames = tables => {
    const folders = new Set();
    for (let table of tables.filter(hasFolderName)) {
      const idx = table.name.indexOf("_");
      folders.add(table.name.substring(0, idx));
    }
    return [...folders];
  };

  profileAndExtensionTableOrder = (a, b) => {
    if (isProfileTable(a)) {
      return -1;
    }
    if (isProfileTable(b)) {
      return 1;
    }
    return 0;
  };

  getEdwFoldersAndSelectedEntities = (database, selectedTableId) => {
    let folders = {};
    const other = [];
    let selectedFolder = null;
    let selectedProfile = null;
    let selectedExtension = null;
    const sortedTables = database &&
      database.tables &&
      database.tables.sort((a, b) => this.profileAndExtensionTableOrder(a.name, b.name)) || [];

    // constructs Edw database's metadata for table selection dropdown list
    for (let table of sortedTables) {
      const tableName = table.name;
      if (tableName && hasFolderName(tableName)) {
        // finds folders
        const folderName = getFolderName(tableName);
        folders[folderName] = folders[folderName] ||
          {
            name: folderName,
            type: FOLDER_TYPE,
            profiles: {},
            otherTables: [],
          };
        // finds profiles
        if (isProfileTable(tableName)) {
          const profileName = getFolderChildTableName(tableName, folderName, PROFILE_TABLE_KEY);
          folders[folderName].profiles[profileName] = profileName &&
            profileName.length > 1 &&
            (folders[folderName].profiles[profileName] ||
              {
                name: profileName,
                type: PROFILE_TYPE,
                profile: {
                  name: profileName,
                  type: PROFILE_TYPE,
                  table: table,
                  extensions: {},
                }
              });
        } else if (isExtensionTable(tableName)) {
          // finds extensions
          const name = getFolderChildTableName(tableName, folderName, EXTENSION_TABLE_KEY);
          const token = name.split(" ");
          if (token && token.length > 1) {
            const profileName = token[0];
            const extensionName = token[1];
            if (folders[folderName].profiles[profileName]) {
              folders[folderName].profiles[profileName].profile.extensions[token[1]] = folders[folderName].profiles[profileName].profile.extensions[extensionName] ||
                {
                  name: extensionName,
                  type: EXTENSION_TYPE,
                  table: table,
                };
            } 
         }
        } else if(isFolderRelatedTable(folderName, tableName)) {
          folders[folderName].otherTables.push(table);
        } else {
          other.push(table);
        }
      } else {
        other.push(table);
      }
    }

    // convert hash map like objects to arrays of the values of properties of the object.
    const folderArray = [...Object.values(folders)];
    folderArray.sort((a, b) => a.name.localeCompare(b.name));
    for (let folder of folderArray) {
      folder.profiles = Object.values(folder.profiles);
      folder.profiles.sort((a, b) => a.name.localeCompare(b.name));
      folder.otherTables.sort((a, b) => a.name.localeCompare(b.name));
      for (let profile of folder.profiles) {
        if (!selectedProfile && profile.profile.table && profile.profile.table.id === selectedTableId) {
          selectedProfile = profile;
          selectedFolder = folder;
        }
        profile.profile.extensions = Object.values(profile.profile.extensions);
        profile.profile.extensions = profile.profile.extensions.sort((a, b) => a.name.localeCompare(b.name));
        if (!selectedExtension) {
          for (let extension of profile.profile.extensions) {
            if (extension.table && extension.table.id === selectedTableId) {
              selectedExtension = extension;
              selectedProfile = profile;
              selectedFolder = folder;
            }
          }
        }
      }
      for (let otherFolderTable of folder.otherTables) {
        if (otherFolderTable.id === selectedTableId) {
          selectedFolder = folder;
          selectedExtension = null;
          selectedProfile = null;
        }
      }
    }
    folders = folderArray;
    other.sort((a, b) => a.name.localeCompare(b.name));
    folders.push({
      name: EVERYTHING_ELSE_FOLDER,
      type: OTHER_TYPE,
      tables: other,
    })
    // If the selected folder is still not found,
    // check the selected folder in the Everything else folder containing  all tables that don't belong to any found EDW folders.
    if (!selectedFolder) {
      for (let table of other) {
        if (table.id === selectedTableId) {
          selectedFolder = folders[folders.length - 1];
          break;
        }
      }
    }
    return {
      folders: folders,
      selectedFolder: selectedFolder,
      selectedProfile: selectedProfile,
      selectedExtension: selectedExtension
    };
  };

  getStepsAndSelectedEntities = props => {
    let selectedSchema, selectedTable;
    let selectedDatabaseId = props.selectedDatabaseId;
    let { selectedFolder, selectedProfile, selectedExtension } = props;
    // augment databases with schemas
    const databases =
      props.databases &&
      props.databases.map(database => {
        let schemas = {};
        for (let table of database.tables.filter(isQueryable)) {
          let name = table.schema || "";
          schemas[name] = schemas[name] || {
            name: titleize(humanize(name)),
            database: database,
            tables: [],
          };
          schemas[name].tables.push(table);
          if (props.selectedTableId && table.id === props.selectedTableId) {
            selectedSchema = schemas[name];
            selectedDatabaseId = selectedSchema.database.id;
            selectedTable = table;
          }
        }
        schemas = Object.values(schemas);
        // Hide the schema name if there is only one schema
        if (schemas.length === 1) {
          schemas[0].name = "";
        }
        const edwDatabaseResult = isEDW(database.name) && database.id > 0 ?
          this.getEdwFoldersAndSelectedEntities(database, props.selectedTableId) : null;
        
        if(edwDatabaseResult){
          selectedFolder = selectedFolder ? selectedFolder : edwDatabaseResult.selectedFolder;
          selectedProfile = selectedProfile ? selectedProfile : edwDatabaseResult.selectedProfile;
          selectedExtension = selectedExtension ? selectedExtension : edwDatabaseResult.selectedExtension;
        }
        return {
          ...database,
          schemas: schemas.sort((a, b) => a.name.localeCompare(b.name)),
          folders: edwDatabaseResult ? edwDatabaseResult.folders : [],
        };
      });

    const selectedDatabase = selectedDatabaseId
      ? databases.find(db => db.id === selectedDatabaseId)
      : null;
    const hasMultipleSchemas =
      selectedDatabase &&
      _.uniq(selectedDatabase.tables, t => t.schema).length > 1;

    // remove the schema step if a database is already selected and the database does not have more than one schema.
    let steps = [...props.steps];
    if (
      selectedDatabase &&
      !hasMultipleSchemas &&
      steps.includes(SCHEMA_STEP)
    ) {
      steps.splice(props.steps.indexOf(SCHEMA_STEP), 1);
      selectedSchema = selectedDatabase.schemas[0];
    }

    if (selectedDatabase &&
      !isEDW(selectedDatabase.name) &&
      steps.includes(DATABASE_FOLDER_STEP)
    ) {
      selectedFolder = null;
      selectedProfile = null;
      selectedExtension = null;
      steps = [DATABASE_FOLDER_STEP, TABLE_STEP];
    }
  
    if (selectedDatabase &&
      selectedFolder &&
      selectedFolder.type === OTHER_TYPE &&
      !selectedProfile && !selectedExtension) {
      steps = [DATABASE_FOLDER_STEP, EDW_TABLE_STEP];
    }

      // if a db is selected but schema isn't, default to the first schema
    selectedSchema =
      selectedSchema || (selectedDatabase && selectedDatabase.schemas[0]);

    const selectedSegmentId = props.selectedSegmentId;
    const selectedSegment = selectedSegmentId
      ? props.segments.find(segment => segment.id === selectedSegmentId)
      : null;
    const selectedField = props.selectedFieldId
      ? props.metadata.fields[props.selectedFieldId]
      : null;

    return {
      databases,
      selectedDatabase,
      selectedSchema,
      selectedTable,
      selectedSegment,
      selectedField,
      selectedFolder,
      selectedProfile,
      selectedExtension,
      steps,
    };
  };

  static propTypes = {
    selectedDatabaseId: PropTypes.number,
    selectedTableId: PropTypes.number,
    selectedFieldId: PropTypes.number,
    selectedSegmentId: PropTypes.number,
    databases: PropTypes.array.isRequired,
    segments: PropTypes.array,
    disabledTableIds: PropTypes.array,
    disabledSegmentIds: PropTypes.array,
    setDatabaseFn: PropTypes.func,
    setFieldFn: PropTypes.func,
    setSourceTableFn: PropTypes.func,
    setSourceSegmentFn: PropTypes.func,
    isInitiallyOpen: PropTypes.bool,
    renderAsSelect: PropTypes.bool,
  };

  static defaultProps = {
    isInitiallyOpen: false,
    renderAsSelect: false,
  };

  componentWillMount() {
    const useOnlyAvailableDatabase =
      !this.props.selectedDatabaseId &&
      this.props.databases.length === 1 &&
      !this.props.segments;
    if (useOnlyAvailableDatabase) {
      setTimeout(() => this.onChangeDatabase(0));
    }

    this.hydrateActiveStep();
  }

  componentWillReceiveProps(nextProps) {
    const newStateProps = this.getStepsAndSelectedEntities(nextProps);

    // only update non-empty properties
    this.setState(_.pick(newStateProps, propValue => !!propValue));
  }

  hydrateActiveStep() {
    if (this.props.selectedFieldId) {
      this.switchToStep(FIELD_STEP);
    } else if (this.props.selectedSegmentId) {
      this.switchToStep(SEGMENT_OR_TABLE_STEP);
    } else if (this.props.selectedTableId) {
      if (this.props.segments) {
        this.switchToStep(SEGMENT_OR_TABLE_STEP);
      } else if(this.state.selectedExtension) {
        this.switchToStep(EDW_TABLE_STEP);
      } else if(this.state.selectedProfile) {
        this.switchToStep(PROFILE_TABLE_STEP);
      } else if(this.state.selectedFolder && this.state.selectedFolder.otherTables) {
        this.switchToStep(PROFILE_STEP);
      } else if (this.state.selectedFolder) {
        this.switchToStep(EDW_TABLE_STEP);
      } else {
        this.switchToStep(TABLE_STEP);
      }
    } else {
      let firstStep = this.state.steps[0];
      this.switchToStep(firstStep);
    }
  }

  nextStep = (stateChange = {}) => {
    let activeStepIndex = this.state.steps.indexOf(this.state.activeStep);
    if (activeStepIndex + 1 >= this.state.steps.length) {
      this.setState(stateChange);
      this.refs.popover.toggle();
    } else {
      const nextStep = this.state.steps[activeStepIndex + 1];
      this.switchToStep(nextStep, stateChange);
    }
  };

  edwTableStep = (stateChange = {}) => {
    const updatedState = {
      ...stateChange,
      steps: [DATABASE_FOLDER_STEP, EDW_TABLE_STEP]
    }
    this.switchToStep(EDW_TABLE_STEP, updatedState);
  }

  switchToStep = async (stepName, stateChange = {}) => {
    const updatedState = {
      ...this.state,
      ...stateChange,
      activeStep: stepName,
    };

    const loadersForSteps = {
      [FIELD_STEP]: () =>
        updatedState.selectedTable &&
        this.props.fetchTableMetadata(updatedState.selectedTable.id),
    };

    if (loadersForSteps[stepName]) {
      this.setState({ ...updatedState, isLoading: true });
      await loadersForSteps[stepName]();
    }

    this.setState({
      ...updatedState,
      isLoading: false,
    });
  };

  hasPreviousStep = () => {
    return !!this.state.steps[
      this.state.steps.indexOf(this.state.activeStep) - 1
    ];
  };

  hasAdjacentStep = () => {
    return !!this.state.steps[
      this.state.steps.indexOf(this.state.activeStep) + 1
    ];
  };

  onBack = () => {
    if (!this.hasPreviousStep()) {
      return;
    }
    const previousStep = this.state.steps[
      this.state.steps.indexOf(this.state.activeStep) - 1
    ];
    this.switchToStep(previousStep);
  };

  onChangeDatabase = (index, schemaInSameStep) => {
    let database = this.state.databases[index];
    let schema =
      database && (database.schemas.length > 1 ? null : database.schemas[0]);
    if (database && database.tables.length === 0) {
      schema = {
        database: database,
        name: "",
        tables: [],
      };
    }
    const stateChange = {
      selectedDatabase: database,
      selectedSchema: schema,
    };

    this.props.setDatabaseFn && this.props.setDatabaseFn(database.id);

    if (schemaInSameStep) {
      if (database.schemas.length > 1) {
        this.setState(stateChange);
      } else {
        this.nextStep(stateChange);
      }
    } else {
      this.nextStep(stateChange);
    }
  };

  onChangeSchema = schema => {
    this.nextStep({ selectedSchema: schema });
  };

  onChangeTable = item => {
    if (item.table != null) {
      this.props.setSourceTableFn && this.props.setSourceTableFn(item.table.id);
      this.nextStep({ selectedTable: item.table });
    }
  };

  onChangeField = item => {
    if (item.field != null) {
      this.props.setFieldFn && this.props.setFieldFn(item.field.id);
      this.nextStep({ selectedField: item.field });
    }
  };

  onChangeSegment = item => {
    if (item.segment != null) {
      this.props.setSourceSegmentFn &&
        this.props.setSourceSegmentFn(item.segment.id);
      this.nextStep({ selectedTable: null, selectedSegment: item.segment });
    }
  };

  onShowSegmentSection = () => {
    // Jumping to the next step SEGMENT_OR_TABLE_STEP without a db/schema
    // indicates that we want to show the segment section
    this.nextStep({ selectedDatabase: null, selectedSchema: null });
  };

  onChangeFolder = folder => {
    if (folder.type === FOLDER_TYPE) {
      this.nextStep({ selectedFolder: folder });
    } else if (folder.type === OTHER_TYPE) {
      this.edwTableStep({ selectedFolder: folder, selectedProfile: null });
    } else {
      return this.onChangeSchema(folder);
    }
  };

  onChangeProfileOrFolderTable = item => {
    if (item.type === PROFILE_TYPE) {
      this.nextStep({selectedProfile: item});
    } else if (item.type === TABLE_TYPE && item.table) {
      let { steps } = this.state;
      if (steps.includes(PROFILE_TABLE_STEP)){
        steps.splice(steps.indexOf(PROFILE_TABLE_STEP), 2);
      }
      this.onChangeTable(item);
    }
  };

  onChangeExtension = extension => {
    this.nextStep({ selectedExtension: extension});
  };

  onChangeProfileTable = item =>{
    if(item.table != null){
      let {steps} = this.state;
      if(steps.includes(EDW_TABLE_STEP)){
        steps.splice(steps.indexOf(EDW_TABLE_STEP), 1)
      }
      this.onChangeTable(item);
    }else{
      this.onChangeExtension(item);
    }
};

  onChangeDatabaseAndFolder = (index, schemaInSameStep) => {
    let database = this.state.databases[index];
    let databaseName = database.name.toUpperCase();
    if (!databaseName || (databaseName && !databaseName.endsWith("EDW"))) {
      return this.onChangeDatabase(index, schemaInSameStep);
    }
    let folder =
      database && (database.folders.length > 1 ? null : database.folders[0])
    if (database && database.tables.length === 0) {
      folder = {
        name: "",
        type: FOLDER_TYPE,
        profiles: [],
      };
    }
    const stateChange = {
      selectedDatabase: database,
      selectedFolder: folder,
    }
    this.props.setDatabaseFn && this.props.setDatabaseFn(database.id);
    if (schemaInSameStep && database.folders.length > 1) {
      this.setState(stateChange);
    } else {
      this.nextStep(stateChange);
    }
  }

  onChangeEdwTable = item => {
    if (item.table != null) {
      this.props.setSourceTableFn && this.props.setSourceTableFn(item.table.id);
      if (item.isEveryElseTable) {
        this.nextStep({ selectedTable: item.table, selectedProfile: null });
      } else {
        this.nextStep({ selectedTable: item.table });
      }
    }
  };

  onBackEdwTable = () => {
    if (!this.hasPreviousStep()) {
      return;
    }
    const previousStep = this.state.steps[
      this.state.steps.indexOf(this.state.activeStep) - 1
    ];
    this.switchToStep(previousStep, { steps: [DATABASE_FOLDER_STEP, PROFILE_STEP, PROFILE_TABLE_STEP, EDW_TABLE_STEP] });
  };

  getTriggerElement() {
    const {
      className,
      style,
      triggerIconSize,
      getTriggerElementContent,
    } = this.props;
    const {
      selectedDatabase,
      selectedSegment,
      selectedTable,
      selectedField,
    } = this.state;

    return (
      <span
        className={className || "px2 py2 text-bold cursor-pointer text-default"}
        style={style}
      >
        {React.createElement(getTriggerElementContent, {
          selectedDatabase,
          selectedSegment,
          selectedTable,
          selectedField,
        })}
        <Icon className="ml1" name="chevrondown" size={triggerIconSize || 8} />
      </span>
    );
  }

  renderActiveStep() {
    const {
      segments,
      skipDatabaseSelection,
      disabledTableIds,
      disabledSegmentIds,
    } = this.props;
    const {
      databases,
      isLoading,
      selectedDatabase,
      selectedSchema,
      selectedTable,
      selectedField,
      selectedSegment,
      selectedFolder,
      selectedProfile,
      selectedExtension,
    } = this.state;

    const hasAdjacentStep = this.hasAdjacentStep();

    switch (this.state.activeStep) {
      case DATABASE_STEP:
        return (
          <DatabasePicker
            databases={databases}
            selectedDatabase={selectedDatabase}
            onChangeDatabase={this.onChangeDatabase}
            hasAdjacentStep={hasAdjacentStep}
          />
        );
      case DATABASE_SCHEMA_STEP:
        return (
          <DatabaseSchemaPicker
            skipDatabaseSelection={skipDatabaseSelection}
            databases={databases}
            selectedDatabase={selectedDatabase}
            selectedSchema={selectedSchema}
            onChangeSchema={this.onChangeSchema}
            onChangeDatabase={this.onChangeDatabase}
            hasAdjacentStep={hasAdjacentStep}
          />
        );
      case SCHEMA_STEP:
        return (
          <SchemaPicker
            selectedDatabase={selectedDatabase}
            selectedSchema={selectedSchema}
            onChangeSchema={this.onChangeSchema}
            hasAdjacentStep={hasAdjacentStep}
          />
        );
      case SCHEMA_AND_SEGMENTS_STEP:
        return (
          <SegmentAndDatabasePicker
            databases={databases}
            selectedSchema={selectedSchema}
            onChangeSchema={this.onChangeSchema}
            onShowSegmentSection={this.onShowSegmentSection}
            onChangeDatabase={this.onChangeDatabase}
            hasAdjacentStep={hasAdjacentStep}
          />
        );
      case TABLE_STEP:
        return (
          <TablePicker
            selectedDatabase={selectedDatabase}
            selectedSchema={selectedSchema}
            selectedTable={selectedTable}
            databases={databases}
            segments={segments}
            disabledTableIds={disabledTableIds}
            onChangeTable={this.onChangeTable}
            onBack={this.hasPreviousStep() && this.onBack}
            hasAdjacentStep={hasAdjacentStep}
          />
        );
      case FIELD_STEP:
        return (
          <FieldPicker
            isLoading={isLoading}
            selectedTable={selectedTable}
            selectedField={selectedField}
            onChangeField={this.onChangeField}
            onBack={this.onBack}
          />
        );
      case SEGMENT_OR_TABLE_STEP:
        if (selectedDatabase && selectedSchema) {
          return (
            <TablePicker
              selectedDatabase={selectedDatabase}
              selectedSchema={selectedSchema}
              selectedTable={selectedTable}
              databases={databases}
              segments={segments}
              disabledTableIds={disabledTableIds}
              onChangeTable={this.onChangeTable}
              hasPreviousStep={this.hasPreviousStep}
              onBack={this.onBack}
            />
          );
        } else {
          return (
            <SegmentPicker
              segments={segments}
              selectedSegment={selectedSegment}
              disabledSegmentIds={disabledSegmentIds}
              onBack={this.onBack}
              onChangeSegment={this.onChangeSegment}
            />
          );
        }
      case DATABASE_FOLDER_STEP:
        return (
          <DatabaseFolderPicker
            skipDatabaseSelection={skipDatabaseSelection}
            databases={databases}
            selectedDatabase={selectedDatabase}
            selectedFolder={selectedFolder || selectedSchema}
            onChangeFolder={this.onChangeFolder}
            onChangeDatabase={this.onChangeDatabaseAndFolder}
            hasAdjacentStep={hasAdjacentStep}
          />
        )
      case PROFILE_STEP:
        return (
          <ProfilePicker
            selectedDatabase={selectedDatabase}
            selectedFolder={selectedFolder}
            selectedProfile={selectedProfile}
            selectedTable={selectedTable}
            onChangeProfile={this.onChangeProfileOrFolderTable}
            hasAdjacentStep={hasAdjacentStep}
            disabledTableIds={disabledSegmentIds}
            onBack={this.hasPreviousStep() && this.onBackEdwTable}
          />
        )
      case EDW_TABLE_STEP:
        return (
          <EdwTablePicker
            databases={databases}
            disabledTableIds={disabledTableIds}
            onChangeTable={this.onChangeEdwTable}
            onBack={this.hasPreviousStep() && this.onBackEdwTable}
            selectedDatabase={selectedDatabase}
            selectedFolder={selectedFolder}
            selectedProfile={selectedProfile}
            selectedExtension={selectedExtension}
            selectedTable={selectedTable}
          />
        )
      case PROFILE_TABLE_STEP:
        return (
          <ProfileTablePicker
            databases={databases}
            disabledTableIds={disabledTableIds}
            onChangeTable={this.onChangeProfileTable}
            onBack={this.hasPreviousStep() && this.onBackEdwTable}
            selectedDatabase={selectedDatabase}
            selectedFolder={selectedFolder}
            selectedProfile={selectedProfile}
            selectedExtension={selectedExtension}
            selectedTable={selectedTable}
          />
        )
    }

    return null;
  }

  render() {
    const triggerClasses = this.props.renderAsSelect
      ? "border-med bg-white block no-decoration"
      : "flex align-center";
    const style = {
      width: "300px",
      overflowY: "auto"
    }
    return (
      <PopoverWithTrigger
        id="DataPopover"
        ref="popover"
        isInitiallyOpen={this.props.isInitiallyOpen}
        triggerElement={this.getTriggerElement()}
        triggerClasses={triggerClasses}
        horizontalAttachments={["center", "left", "right"]}
        sizeToFit
        style = {style}
      >
        {this.renderActiveStep()}
      </PopoverWithTrigger>
    );
  }
}

const DatabasePicker = ({
  databases,
  selectedDatabase,
  onChangeDatabase,
  hasAdjacentStep,
}) => {
  if (databases.length === 0) {
    return <DataSelectorLoading />;
  }

  let sections = [
    {
      items: databases.map((database, index) => ({
        name: database.name,
        index,
        database: database,
      })),
    },
  ];

  return (
    <AccordianList
      id="DatabasePicker"
      key="databasePicker"
      className="text-brand"
      sections={sections}
      onChange={db => onChangeDatabase(db.index)}
      itemIsSelected={item =>
        selectedDatabase && item.database.id === selectedDatabase.id
      }
      renderItemIcon={() => (
        <Icon className="Icon text-default" name="database" size={18} />
      )}
      showItemArrows={hasAdjacentStep}
    />
  );
};

const SegmentAndDatabasePicker = ({
  databases,
  selectedSchema,
  onChangeSchema,
  onShowSegmentSection,
  onChangeDatabase,
  hasAdjacentStep,
}) => {
  const segmentItem = [{ name: "Segments", items: [], icon: "segment" }];

  const sections = segmentItem.concat(
    databases.map(database => {
      return {
        name: database.name,
        items: database.schemas.length > 1 ? database.schemas : [],
      };
    }),
  );

  // FIXME: this seems a bit brittle and hard to follow
  let openSection =
    selectedSchema &&
    _.findIndex(databases, db => _.find(db.schemas, selectedSchema)) +
      segmentItem.length;
  if (
    openSection >= 0 &&
    databases[openSection - segmentItem.length] &&
    databases[openSection - segmentItem.length].schemas.length === 1
  ) {
    openSection = -1;
  }

  return (
    <AccordianList
      id="SegmentAndDatabasePicker"
      key="segmentAndDatabasePicker"
      className="text-brand"
      sections={sections}
      onChange={onChangeSchema}
      onChangeSection={index => {
        index === 0
          ? onShowSegmentSection()
          : onChangeDatabase(index - segmentItem.length, true);
      }}
      itemIsSelected={schema => selectedSchema === schema}
      renderSectionIcon={section => (
        <Icon
          className="Icon text-default"
          name={section.icon || "database"}
          size={18}
        />
      )}
      renderItemIcon={() => <Icon name="folder" size={16} />}
      initiallyOpenSection={openSection}
      showItemArrows={hasAdjacentStep}
      alwaysTogglable={true}
    />
  );
};

export const SchemaPicker = ({
  selectedDatabase,
  selectedSchema,
  onChangeSchema,
  hasAdjacentStep,
}) => {
  let sections = [
    {
      items: selectedDatabase.schemas,
    },
  ];
  return (
    <div style={{ width: 300 }}>
      <AccordianList
        id="DatabaseSchemaPicker"
        key="databaseSchemaPicker"
        className="text-brand"
        sections={sections}
        searchable
        onChange={onChangeSchema}
        itemIsSelected={schema => schema === selectedSchema}
        renderItemIcon={() => <Icon name="folder" size={16} />}
        showItemArrows={hasAdjacentStep}
      />
    </div>
  );
};

export const DatabaseSchemaPicker = ({
  skipDatabaseSelection,
  databases,
  selectedDatabase,
  selectedSchema,
  onChangeSchema,
  onChangeDatabase,
  hasAdjacentStep,
}) => {
  if (databases.length === 0) {
    return <DataSelectorLoading />;
  }

  const sections = databases.map(database => ({
    name: database.name,
    items: database.schemas.length > 1 ? database.schemas : [],
    className: database.is_saved_questions ? "bg-light" : null,
    icon: database.is_saved_questions ? "all" : "database",
  }));

  let openSection =
    selectedSchema &&
    _.findIndex(databases, db => _.find(db.schemas, selectedSchema));
  if (
    openSection >= 0 &&
    databases[openSection] &&
    databases[openSection].schemas.length === 1
  ) {
    openSection = -1;
  }

  return (
    <div className="scroll-y">
      <AccordianList
        id="DatabaseSchemaPicker"
        key="databaseSchemaPicker"
        className="text-brand"
        sections={sections}
        onChange={onChangeSchema}
        onChangeSection={dbId => onChangeDatabase(dbId, true)}
        itemIsSelected={schema => schema === selectedSchema}
        renderSectionIcon={item => (
          <Icon className="Icon text-default" name={item.icon} size={18} />
        )}
        renderItemIcon={() => <Icon name="folder" size={16} />}
        initiallyOpenSection={openSection}
        alwaysTogglable={true}
        showItemArrows={hasAdjacentStep}
      />
    </div>
  );
};

export const TablePicker = ({
  selectedDatabase,
  selectedSchema,
  selectedTable,
  disabledTableIds,
  onChangeTable,
  hasAdjacentStep,
  onBack,
}) => {
  // In case DataSelector props get reseted
  if (!selectedDatabase) {
    if (onBack) {
      onBack();
    }
    return null;
  }

  const isSavedQuestionList = selectedDatabase.is_saved_questions;
  let header = (
    <div className="flex flex-wrap align-center">
      <span
        className={cx("flex align-center", {
          "text-brand-hover cursor-pointer": onBack,
        })}
        onClick={onBack}
      >
        {onBack && <Icon name="chevronleft" size={18} />}
        <span className="ml1">{selectedDatabase.name}</span>
      </span>
      {selectedSchema.name && (
        <span className="ml1 text-slate">- {selectedSchema.name}</span>
      )}
    </div>
  );

  if (selectedSchema.tables.length === 0) {
    // this is a database with no tables!
    return (
      <section
        className="List-section List-section--open"
        style={{ width: 300 }}
      >
        <div className="p1 border-bottom">
          <div className="px1 py1 flex align-center">
            <h3 className="text-default">{header}</h3>
          </div>
        </div>
        <div className="p4 text-centered">{t`No tables found in this database.`}</div>
      </section>
    );
  } else {
    let sections = [
      {
        name: header,
        items: selectedSchema.tables.map(table => ({
          name: table.display_name,
          disabled: disabledTableIds && disabledTableIds.includes(table.id),
          table: table,
          database: selectedDatabase,
        })),
      },
    ];
    return (
      <div style={{ width: 300 }} className="scroll-y">
        <AccordianList
          id="TablePicker"
          key="tablePicker"
          className="text-brand"
          sections={sections}
          searchable
          onChange={onChangeTable}
          itemIsSelected={item =>
            item.table && selectedTable
              ? item.table.id === selectedTable.id
              : false
          }
          itemIsClickable={item => item.table && !item.disabled}
          renderItemIcon={item =>
            item.table ? <Icon name="table2" size={18} /> : null
          }
          showItemArrows={hasAdjacentStep}
        />
        {isSavedQuestionList && (
          <div className="bg-light p2 text-centered border-top">
            {t`Is a question missing?`}
            <a
              href="http://softheon-foundry.com/docs/latest/users-guide/04-asking-questions.html#source-data"
              className="block link"
            >{t`Learn more about nested queries`}</a>
          </div>
        )}
      </div>
    );
  }
};

@connect(state => ({ metadata: getMetadata(state) }))
export class FieldPicker extends Component {
  render() {
    const {
      isLoading,
      selectedTable,
      selectedField,
      onChangeField,
      metadata,
      onBack,
    } = this.props;
    // In case DataSelector props get reseted
    if (!selectedTable) {
      if (onBack) {
        onBack();
      }
      return null;
    }

    const header = (
      <span className="flex align-center">
        <span
          className="flex align-center text-slate cursor-pointer"
          onClick={onBack}
        >
          <Icon name="chevronleft" size={18} />
          <span className="ml1">{selectedTable.display_name || t`Fields`}</span>
        </span>
      </span>
    );

    if (isLoading) {
      return <DataSelectorLoading header={header} />;
    }

    const table = metadata.tables[selectedTable.id];
    const fields = (table && table.fields) || [];
    const sections = [
      {
        name: header,
        items: fields.map(field => ({
          name: field.display_name,
          field: field,
        })),
      },
    ];

    return (
      <div style={{ width: 300 }}>
        <AccordianList
          id="FieldPicker"
          key="fieldPicker"
          className="text-brand"
          sections={sections}
          searchable
          onChange={onChangeField}
          itemIsSelected={item =>
            item.field && selectedField
              ? item.field.id === selectedField.id
              : false
          }
          itemIsClickable={item => item.field && !item.disabled}
          renderItemIcon={item =>
            item.field ? (
              <Icon name={item.field.dimension().icon()} size={18} />
            ) : null
          }
        />
      </div>
    );
  }
}

//TODO: refactor this. lots of shared code with renderTablePicker = () =>
export const SegmentPicker = ({
  segments,
  selectedSegment,
  disabledSegmentIds,
  onBack,
  onChangeSegment,
}) => {
  const header = (
    <span className="flex align-center">
      <span
        className="flex align-center text-slate cursor-pointer"
        onClick={onBack}
      >
        <Icon name="chevronleft" size={18} />
        <span className="ml1">{t`Segments`}</span>
      </span>
    </span>
  );

  if (!segments || segments.length === 0) {
    return (
      <section
        className="List-section List-section--open"
        style={{ width: "300px" }}
      >
        <div className="p1 border-bottom">
          <div className="px1 py1 flex align-center">
            <h3 className="text-default">{header}</h3>
          </div>
        </div>
        <div className="p4 text-centered">{t`No segments were found.`}</div>
      </section>
    );
  }

  const sections = [
    {
      name: header,
      items: segments.map(segment => ({
        name: segment.name,
        segment: segment,
        disabled: disabledSegmentIds && disabledSegmentIds.includes(segment.id),
      })),
    },
  ];

  return (
    <AccordianList
      id="SegmentPicker"
      key="segmentPicker"
      className="text-brand"
      sections={sections}
      searchable
      searchPlaceholder={t`Find a segment`}
      onChange={onChangeSegment}
      itemIsSelected={item =>
        selectedSegment && item.segment
          ? item.segment.id === selectedSegment.id
          : false
      }
      itemIsClickable={item => item.segment && !item.disabled}
      renderItemIcon={item =>
        item.segment ? <Icon name="segment" size={18} /> : null
      }
    />
  );
};

const DataSelectorLoading = ({ header }) => {
  if (header) {
    return (
      <section
        className="List-section List-section--open"
        style={{ width: 300 }}
      >
        <div className="p1 border-bottom">
          <div className="px1 py1 flex align-center">
            <h3 className="text-default">{header}</h3>
          </div>
        </div>
        <LoadingAndErrorWrapper loading />;
      </section>
    );
  } else {
    return <LoadingAndErrorWrapper loading />;
  }
};

export const DatabaseFolderPicker = ({
  skipDatabaseSelection,
  databases,
  selectedDatabase,
  selectedFolder,
  onChangeFolder,
  selectedSchema,
  onChangeDatabase,
  hasAdjacentStep
}) => {
  if(databases.length === 0){
    return <DataSelectorLoading/>;
  }

  const getSubSections =  database => {
    if(isEDW(database.name)){
      return database.folders.length > 1 ? database.folders : [];
    }
    else{
      return database.schemas.length > 1 ? database.schemas : [];
    }
  }
  const sections = databases.map(database => ({
    name: database.name,
    items: getSubSections(database),
    className: database.is_saved_questions ? "bg-slate-extra-light" : null,
    icon: database.is_saved_questions? "all" : "database",
  }));

  let openSection = 
    selectedFolder && 
    _.findIndex(databases, db => _.find(db.folders, selectedFolder));
  if(
      openSection >= 0 &&
      databases[openSection] &&
      databases[openSection].folders.length === 1
  ){
    openSection = -1;
  }
  return (
    <div>
      <AccordianList
        id="DatabaseFolderPicker"
        key="databaseFolderPicker"
        className="text-brand"
        sections={sections}
        onChange={onChangeFolder}
        onChangeSection={dbId => onChangeDatabase(dbId, true)}
        itemIsSelected = {folder => folder === selectedFolder || folder === selectedSchema}
        renderSectionIcon={item =>(
          <Icon className="Icon text-default" name={item.icon} size={18}/>
        )}
        renderItemIcon = {() => (<Icon name="folder" size={16}/>)}
        initiallyOpenSection={openSection}
        alwaysTogglable = {true}
        showItemArrows={hasAdjacentStep}
      />
    </div>
  )
};

export const ProfilePicker = ({
  selectedDatabase,
  selectedFolder,
  selectedProfile,
  selectedTable,
  onChangeProfile,
  hasAdjacentStep,
  disabledTableIds,
  onBack,
}) => {
  if(!selectedDatabase || !selectedFolder){
    if(onBack) {
      onBack();
    }
    return null;
  }
  let header =(
    <div className="flex flex-wrap align-center">
      <span
        className={cx("flex align-center", {
          "text-brand-hover cursor-pointer" : onBack,
        })}
        onClick={onBack}
      >
        {onBack && <Icon name="chevronleft" size={18} />}
        <span className="ml1">{selectedDatabase.name}</span>
      </span>
      {selectedFolder.name && (
        <span className="ml1 text-slate link--wrappable">{selectedFolder.name}</span>
      )}
    </div>
  );
  const profiles = selectedFolder && selectedFolder.profiles;
  if(profiles.length === 0){
    return (
      <section
        className="List-section List-section--open"
        style={{ width: 300 }}
      >
        <div className="p1 border-bottom">
          <div className="px1 py1 flex align-center">
            <h3 className="text-default">{header}</h3>
          </div>
        </div>
        <div className="p4 text-centered">{t`No Profiles found in this database.`}</div>
      </section>
    )
  } else {
    let unClassifiedFolderTables = selectedFolder.otherTables;
    let items = [];
    for(let profile of profiles){
      items.push({
        ...profile,
        type: PROFILE_TYPE,
        table: null,
        disabled: false,
        database: selectedDatabase,
        showItemArrows:true,
      });
    }

    for(let folderTable of unClassifiedFolderTables){
      items.push({
        name: folderTable.name,
        profile: null,
        type: TABLE_TYPE,
        table: folderTable,
        disabled: disabledTableIds && disabledTableIds.includes(folderTable.id),
        database: selectedDatabase,
        showItemArrows: false,
      })
    }
    let sections = [
      {
        name: header,
        items: items,
      }
    ];
    return (
      <div style={{ width: 300 }}>
        <AccordianList
          id="ProfilePicker"
          key="profilePicker"
          className="text-brand"
          sections={sections}
          onChange={onChangeProfile}
          itemIsSelected={item => item === selectedProfile ||
            (item.table && selectedTable && item.table.id === selectedTable.id)}
          itemIsClickable={item => item.profile || (item.table && !item.disabled)}
          renderItemIcon={item =>
            item.table ? <Icon name="table2" size={18} /> :
              item.profile ? <Icon name="folder" size={18} /> : null
          }
        />
      </div>
    )
  }
};

export const EdwTablePicker = ({
  selectedDatabase,
  selectedFolder,
  selectedProfile,
  selectedExtension,
  selectedTable,
  disabledTableIds,
  onChangeTable,
  onBack,
}) => {
  if(!selectedDatabase){
    if(onBack) { 
      onBack();
    }
    return null;
  }

  let tables = null;
  let isEveryElseTable = false;
  if(selectedFolder && selectedProfile && selectedExtension && selectedFolder.type === FOLDER_TYPE){
    tables = 
    //selectedExtension.extensions || 
    (selectedProfile.profile && 
      selectedProfile.profile.extensions && 
      selectedProfile.profile.extensions.map(extension => extension.table)) || [];
  }else if (selectedFolder && selectedFolder.type === EVERYTHING_ELSE){
    tables = selectedFolder.tables;
    isEveryElseTable = true;
  }

  if(!tables){
    return null;
  }
  
  let header = (
    <div className="flex flex-wrap align-center">
      <span
        className={cx("flex align-center", {
          "text-brand-hover cursor-pointer": onBack,
        })}
        onClick={onBack}
      >
        {onBack && <Icon name="chevronleft" size={18} />}
        <span className="ml1">{selectedDatabase.name}</span>
      </span>
      {selectedFolder && selectedFolder.name && (
        <span className="ml1 text-slate link--wrappable">
          {selectedFolder.name}
          {selectedProfile && selectedProfile.name && (
            <Icon className="mx1" name="chevronright" size={12} />
          )}
          {selectedProfile && selectedProfile.name}
          {selectedProfile && selectedProfile.name && (
            <Icon className="mx1" name="chevronright" size={12} />
          )}
          {!isEveryElseTable && selectedExtension && "Extension Tables"}

        </span>
      )}
    </div>
  );
  if(tables.length === 0){
    return (
            <section
        className="List-section List-section--open"
        style={{ width: 300 }}
      >
        <div className="p1 border-bottom">
          <div className="px1 py1 flex align-center">
            <h3 className="text-default">{header}</h3>
          </div>
        </div>
        <div className="p4 text-centered">{t`No Extension tables found in this profile.`}</div>
      </section>
    )
  }else{
    let sections = [
      {
        name: header,
        items: tables.map(table => ({
          name: table.display_name,
          disabled: disabledTableIds && disabledTableIds.includes(table.id),
          table: table,
          database: selectedDatabase,
          isEveryElseTable: isEveryElseTable
        }))
      }];
    return (
      <div style={{ width: 300}}>
        <AccordianList
          id="EdwTablePicker"
          key="edwTablePicker"
          className="text-brand"
          sections={sections}
          searchable
          onChange={onChangeTable}
          itemIsSelected={item =>
            item.table && selectedTable 
              ? item.table.id === selectedTable.id : false
          }
          itemIsClickable={item => item.table && !item.disabled}
          renderItemIcon={item => 
            item.table ? <Icon name="table2" size={18} /> : null
          }
          showItemArrows={false}
        />
      </div>
    );
  }
};

export const ProfileTablePicker = ({
  selectedDatabase,
  selectedFolder,
  selectedProfile,
  selectedTable,
  disabledTableIds,
  onChangeTable,
  onBack,
}) => {
  if(!selectedDatabase){
    if(onBack) {
      onBack();
    }
    return null;
  }
  let profileTable = null
  if(selectedFolder && selectedProfile && selectedProfile.profile.table){
    profileTable = selectedProfile.profile.table;
  }

  let header = (
    <div className="flex flex-wrap align-center">
      <span
        className={cx("flex align-center", {
          "text-brand-hover cursor-pointer": onBack,
        })}
        onClick={onBack}
      >
        {onBack && <Icon name="chevronleft" size={18} />}
        <span className="ml1">{selectedDatabase.name}</span>
      </span>
      {selectedFolder && selectedFolder.name && (
        <span className="ml1 text-slate link--wrappable">
          {selectedFolder.name}
          {selectedProfile && selectedProfile.name && (
            <Icon className="mx1" name="chevronright" size={12}/>
            )}
          {selectedProfile && selectedProfile.name}
        </span>
      )}

    </div>
  );
  if(null && !profileTable){
    return (
            <section
        className="List-section List-section--open"
        style={{ width: 300 }}
      >
        <div className="p1 border-bottom">
          <div className="px1 py1 flex align-center">
            <h3 className="text-default">{header}</h3>
          </div>
        </div>
        <div className="p4 text-centered">{t`No Profiles found in this database.`}</div>
      </section>
    )
  }else{
    let items = [];
    if (profileTable) {
      items.push(
        {
          name: profileTable.display_name,
          disabled: disabledTableIds && disabledTableIds.includes(profileTable.id),
          table: profileTable,
          database: selectedDatabase,
          type: PROFILE_TYPE,
          showItemArrows: false
        }
      )
    }
    items.push({
      name: EXTENSION_TYPE_LABEL,
      disable: false,
      table: null,
      database: selectedDatabase,
      type: EXTENSION_TYPE,
      extensions: Object.values(selectedProfile.profile.extensions).map(extension => extension.table),
      showItemArrows: true
    });

    let sections = [{
      name: header,
      items: items
    }]
      return (
        <div style={{ width: 300}}>
          <AccordianList
            id="ProfileTablePicker"
            key="profileTablePicker"
            className="text-brand"
            sections={sections}
            searchable
            onChange={onChangeTable}
            itemIsSelected={item =>
              item.table && selectedTable 
                ? item.table.id === selectedTable.id : false
            }
            itemIsClickable={item => item.table && !item.disabled || item.type === EXTENSION_TYPE}
            renderItemIcon={item => 
              item.table ? <Icon name="table2" size={18} /> : <Icon name="folder" size={18} />
            }
            showItemArrows={false}
          />
        </div>
      );
  }
};
