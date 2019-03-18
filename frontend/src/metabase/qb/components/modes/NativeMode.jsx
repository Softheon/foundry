/* @flow */

import type { QueryMode } from "metabase/meta/types/Visualization";
import CompoundQueryAction from "../actions/CompoundQueryAction";
import NativeQuerySortAction from "../drill/NativeQuerySortAction";

const NativeMode: QueryMode = {
  name: "native",
  actions: [CompoundQueryAction],
  drills: [NativeQuerySortAction],
};

export default NativeMode;
