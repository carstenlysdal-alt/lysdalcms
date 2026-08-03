import type { PermissionUser } from "./permissions";
import { can, PERMISSIONS } from "./permissions";

export const ARTICLE_STATUSES = [
  "Idé",
  "Indsendt",
  "Vurdering",
  "Godkendt",
  "Tildelt",
  "Research",
  "Udkast",
  "Redigering",
  "Faktatjek",
  "Juridisk kontrol",
  "SEO",
  "Medievalg",
  "Godkendelse",
  "Planlagt",
  "Publiceret",
  "Distribueret",
  "Opdateret",
  "Arkiveret",
  "Afvist",
] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

const normalFlow = ARTICLE_STATUSES.filter((status) => status !== "Afvist");

export function isArticleStatus(value: string): value is ArticleStatus {
  return ARTICLE_STATUSES.includes(value as ArticleStatus);
}

export function canTransition(from: string, to: string, user?: PermissionUser | null) {
  if (!isArticleStatus(from) || !isArticleStatus(to) || from === to) return false;
  if (to === "Publiceret") {
    return (
      (from === "Godkendelse" || from === "Planlagt") &&
      can(user, PERMISSIONS.ARTICLE_PUBLISH)
    );
  }
  if (to === "Godkendelse" && !can(user, PERMISSIONS.ARTICLE_PUBLISH)) return false;
  if (to === "Afvist") return !["Publiceret", "Distribueret", "Arkiveret"].includes(from);
  if (from === "Publiceret" && (to === "Opdateret" || to === "Arkiveret")) {
    return can(user, PERMISSIONS.ARTICLE_PUBLISH);
  }
  return normalFlow.indexOf(to as (typeof normalFlow)[number]) === normalFlow.indexOf(from as (typeof normalFlow)[number]) + 1;
}

export function availableTransitions(from: string, user?: PermissionUser | null) {
  return ARTICLE_STATUSES.filter((to) => canTransition(from, to, user));
}
