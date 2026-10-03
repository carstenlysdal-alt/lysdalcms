export const PERMISSIONS = {
  ARTICLE_CREATE: "article.create",
  ARTICLE_EDIT_ALL: "article.editAll",
  ARTICLE_PUBLISH: "article.publish",
  SOURCE_VIEW_CONFIDENTIAL: "source.viewConfidential",
  SUPPORT_READ: "support.read",
  SUPPORT_MANAGE: "support.manage",
  USERS_MANAGE: "users.manage",
  /** Netværksadgang: må give/fjerne en anden brugers adgang til andre byer (kun byer udføreren selv har). Aldrig via AI-operatøren. */
  NETWORK_MANAGE: "network.manage",
  HONORAR_VIEW: "honorar.view",
  FRONTPAGE_EDIT: "frontpage.edit",
  MEDIA_MANAGE: "media.manage",
  TASK_MANAGE: "task.manage",
  TASK_VIEW_ALL: "task.viewAll",
  HONOR_VIEW_OWN: "honorar.viewOwn",
  HONOR_MANAGE: "honorar.manage",
  CATEGORY_MANAGE: "category.manage",
  NEWSLETTER_MANAGE: "newsletter.manage",
  ADS_MANAGE: "ads.manage",
  INGEST_MANAGE: "ingest.manage",
  /** Godkend maskinindsamlede signaler (Signal) til offentlig visning på forsiden (T5 P1-3). */
  SIGNAL_APPROVE: "signal.approve",
  // T11/T12: modulær forside (docs/review/T11-T12-spec.md)
  FRONTPAGE_LAYOUT_MANAGE: "frontpage.layout.manage",
  FRONTPAGE_SNAPSHOT_APPROVE: "frontpage.snapshot.approve",
  FRONTPAGE_AI_USE: "frontpage.ai.use",
  /** AI-operatøren (tale/skrift → værktøjer). Kan aldrig mere end brugerens egne rettigheder (docs/review/FIX-ai-operator.md). */
  OPERATOR_USE: "operator.use",
  /** AI-forslag i artikel-editoren (overskrifter, SEO, opslagstekster, tags, alt-tekst …). Forslag — aldrig auto-gem/publicér. */
  ARTICLE_AI_USE: "article.ai.use",
  /** Kontrolrummet (/redaktion/kontrolrum): redigér prompts, kilderegister (ratingscore) og feed-definitioner. Ændrer hvordan AI og indtag opfører sig. */
  CONTROLROOM_MANAGE: "controlroom.manage",
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
