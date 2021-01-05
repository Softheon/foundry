import { createEntity } from "metabase/lib/entities";

const Spreadsheets = createEntity({
    name: "spreadsheets",
    path: "/api/spreadsheet",
});

export default Spreadsheets;