export const PERMISSIONS = {
  ARTICLE_CREATE: "article.create",
  ARTICLE_EDIT_ALL: "article.editAll",
  ARTICLE_PUBLISH: "article.publish",
  SOURCE_VIEW_CONFIDENTIAL: "source.viewConfidential",
  SUPPORT_READ: "support.read",
  SUPPORT_MANAGE: "support.manage",
  USERS_MANAGE: "users.manage",
  HONORAR_VIEW: "honorar.view",
  FRONTPAGE_EDIT: "frontpage.edit",
  MEDIA_MANAGE: "media.manage",
  TASK_MANAGE: "task.manage",
  TASK_VIEW_ALL: "task.viewAll",
  HONOR_VIEW_OWN: "honorar.viewOwn",
  HONOR_MANAGE: "honorar.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionUser = {
  id?: string;
  authorId?: string | null;
  permissions?: readonly string[] | null;
};

export function can(user: PermissionUser | null | undefined, permission: Permission) {
  return Boolean(user?.permissions?.includes(permission));
}

export function canEditArticle(
  user: PermissionUser | null | undefined,
  article: { forfatterId: string | null },
) {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return false;
  return can(user, PERMISSIONS.ARTICLE_EDIT_ALL) || user?.authorId === article.forfatterId;
}
