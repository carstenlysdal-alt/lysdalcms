import { PERMISSIONS } from "./permissions";

/**
 * Standardroller (bruges af prisma/seed.ts og prisma/sync-roles.ts).
 * users.manage (brugeradministration, /redaktion/brugere) gives KUN til den øverste administratorrolle (alle rettigheder).
 * Eksisterende databaser: sync-roles er additiv og fjerner ikke rettigheder fra roller, der allerede har den.
 */
export const DEFAULT_ROLES = [
  { navn: "Ansvarshavende redaktør", permissions: Object.values(PERMISSIONS) },
  { navn: "Redaktionsleder", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.ARTICLE_EDIT_ALL, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL, PERMISSIONS.SUPPORT_READ, PERMISSIONS.HONORAR_VIEW, PERMISSIONS.HONOR_MANAGE, PERMISSIONS.TASK_MANAGE, PERMISSIONS.TASK_VIEW_ALL, PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE, PERMISSIONS.FRONTPAGE_AI_USE, PERMISSIONS.OPERATOR_USE, PERMISSIONS.ARTICLE_AI_USE, PERMISSIONS.SIGNAL_APPROVE, PERMISSIONS.NEWSLETTER_MANAGE, PERMISSIONS.CATEGORY_MANAGE] },
  { navn: "Freelancejournalist", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.ARTICLE_AI_USE, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL, PERMISSIONS.HONOR_VIEW_OWN] },
  { navn: "Medieproducent", permissions: [PERMISSIONS.MEDIA_MANAGE, PERMISSIONS.HONOR_VIEW_OWN] },
  { navn: "Community manager", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.NEWSLETTER_MANAGE] },
  { navn: "Salgs- og partnerskabsansvarlig", permissions: [PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_MANAGE, PERMISSIONS.ADS_MANAGE] },
  { navn: "Teknisk produktansvarlig", permissions: [PERMISSIONS.INGEST_MANAGE, PERMISSIONS.CONTROLROOM_MANAGE] },
  { navn: "Støtte", permissions: [PERMISSIONS.SUPPORT_READ] },
] as const;
