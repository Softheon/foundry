import { createSelector } from "reselect";
import _ from "underscore";

export const getGroups = state => state.manager.people.groups;
export const getGroup = state => state.manager.people.group;
export const getModal = state => state.manager.people.modal;
export const getMemberships = state => state.manager.people.memberships;


export const getUsers = createSelector(
  state => state.manager.people.users,
  state => state.manager.people.memberships,
  (users, memberships) =>
    users &&
    _.mapObject(users, user => ({
      ...user,
      memberships:
        memberships &&
        _.chain(memberships)
          .values()
          .filter(m => m.user_id === user.id)
          .map(m => [m.group_id, m])
          .object()
          .value(),
    })),
);

// sort the users list by last_name, ignore case or diacritical marks. If last names are the same then compare by first
// name
// name
const compareNames = (a, b) =>
  a.localeCompare(b, undefined, { sensitivty: "base" });

export const getSortedUsers = createSelector(
  [getUsers],
  users =>
    users &&
    _.values(users).sort(
      (a, b) =>
        compareNames(a.last_name, b.last_name) ||
        compareNames(a.first_name, b.first_name),
    ),
);
