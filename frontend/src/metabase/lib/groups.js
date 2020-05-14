import { t } from "c-3po";

const SPECIAL_GROUP_NAMES = new Map([
  ["All Users", t`All Users`],
  ["Administrators", t`Administrators`],
  ["MetaBot", t`MetaBot`],
  ["IDS Users", t`IDS Users`],
  ["Pulse Users", t`Pulse Users`],
]);

const ADMIN_ONLY_GROUP_NAMES = new Map([
  ["Administrators", t`Administrators`],
  ["MetaBot", t`MetaBot`],
  ["IDS Users", t`IDS Users`],
  ["Pulse Users", t`Pulse Users`],
  ["Manager", t`Manager`]
]);

export function isAdminOnlyGroup(group) {
  return ADMIN_ONLY_GROUP_NAMES.has(group.name)
}

export function isSpecialGroup(group) {
  return SPECIAL_GROUP_NAMES.has(group.name);
}

export function isDefaultGroup(group) {
  return group.name === "All Users";
}

export function isAdminGroup(group) {
  return group.name === "Administrators";
}

export function isMetaBotGroup(group) {
  return group.name === "MetaBot";
}

export function isIdsGroup(group) {
  return group.name === "IDS Users";
}

export function canEditPermissions(group) {
  return !isAdminGroup(group);
}

export function canEditMembership(group) {
  return !isDefaultGroup(group);
}

export function getGroupColor(group) {
  return isAdminGroup(group)
    ? "text-purple"
    : isDefaultGroup(group) ? "text-medium" : "text-brand";
}

export function getGroupNameLocalized(group) {
  if (SPECIAL_GROUP_NAMES.has(group.name)) {
    return SPECIAL_GROUP_NAMES.get(group.name);
  } else {
    return group.name;
  }
}
