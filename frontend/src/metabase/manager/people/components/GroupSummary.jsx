import React from "react";
import { t, ngettext, msgid } from "c-3po";
import { isAdminGroup, isDefaultGroup } from "metabase/lib/groups";

const GroupSummary = ({ groups, selectedGroups }) => {
  let otherGroups = groups.filter(
    g => selectedGroups[g.id] && !isAdminGroup(g) && !isDefaultGroup(g),
  );
  if (otherGroups.length === 1) {
    return <span className="text-brand">{groups[0].name}</span>
  }
  else if (otherGroups.length > 1) {
    return (
      <span className="text-brand">
        {(n => ngettext(msgid`${n} other group`, `${n} other groups`, n))(
          otherGroups.length,
        )}
      </span>
    );
  } else {
    return <span>{t`Default`}</span>
  }
};

export default GroupSummary;
