/* @flow */

import Query from "metabase/lib/query";
import StructuredQuery from "metabase-lib/lib/queries/StructuredQuery";
import { t } from "c-3po";
import type {
  ClickAction,
  ClickActionProps
} from "metabase/meta/types/Visualization";

export default ({ question, clicked }: ClickActionProps): ClickAction[] => {
  const query = question.query();
  if((query instanceof StructuredQuery)){
    return [];
  }
  if (!clicked || !clicked.column || clicked.value !== undefined) {
    return [];
  }
  const { column, columnIndex } = clicked;


  const fieldRef = columnIndex ? ["field-id", columnIndex] : [];
  const [sortFieldRef, sortDirection] = query.sorts()[0] || [];
  const isAlreadySorted =
    sortFieldRef != null && Query.isSameField(sortFieldRef, fieldRef, true);

  const actions = [];
  if (!isAlreadySorted || sortDirection === "descending") {
    actions.push({
      name: "sort-ascending",
      section: "sort",
      title: t`Ascending`,
      sort: () => {
        query.addOrderClause([fieldRef, "ascending"]);
        return query.sortTable("ascending", columnIndex);
      }
    });
  }
  if (!isAlreadySorted || sortDirection === "ascending") {
    actions.push({
      name: "sort-descending",
      section: "sort",
      title: t`Descending`,
      sort: () => {
        query.addOrderClause([fieldRef, "descending"]);
        return query.sortTable("descending", columnIndex);}
    });
  }
  return actions;
};
