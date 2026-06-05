import { Document } from "mongoose";
import { IAdmin } from "../models/adminModel";
import { IEditor } from "../models/editorModel";

export const ROLES = {
  SUPER_ADMIN: "Super-Admin",
  EDITOR: "Editor",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export type AuthenticatedUser = (Document & IAdmin) | (Document & IEditor);

// AdminModel documents are always treated as Super-Admin regardless of their
// legacy stored `role` field; EditorModel documents carry role "Editor".
export function getUserRole(user: AuthenticatedUser): UserRole {
  if ("role" in user && (user as IEditor).role === ROLES.EDITOR) {
    return ROLES.EDITOR;
  }
  return ROLES.SUPER_ADMIN;
}

export function isAdmin(user: AuthenticatedUser): user is Document & IAdmin {
  return getUserRole(user) === ROLES.SUPER_ADMIN;
}

export function isEditor(user: AuthenticatedUser): user is Document & IEditor {
  return getUserRole(user) === ROLES.EDITOR;
}
