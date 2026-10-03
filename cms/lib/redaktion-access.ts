import { PERMISSIONS, can, type Permission, type PermissionUser } from "./permissions";

/**
 * Hvilke rettigheder en redaktionsside kræver (T5 P1-2). Layoutet (`app/redaktion/layout.tsx`) kræver kun login;
 * hver side slår derfor selv op via `getAuthorizedUser(PAGE_PERMISSIONS[side])` (databasen — ikke JWT'en)
 * og viser "Ingen adgang" ved nej. Mindst ÉN af de angivne rettigheder er nok (OR).
 *
 * Princip (governance.md §4): salgsroller må ikke se kildeoplysninger. Kildekontakter, kildelinks (tokens)
 * og meddelerkontakter kræver derfor derudover SOURCE_VIEW_CONFIDENTIAL (se `canViewSourceDetails`).
 */
export const PAGE_PERMISSIONS = {
  engine: [PERMISSIONS.ARTICLE_CREATE],
  kontrolrum: [PERMISSIONS.CONTROLROOM_MANAGE, PERMISSIONS.INGEST_MANAGE],
  indbakke: [PERMISSIONS.ARTICLE_CREATE],
  qa: [PERMISSIONS.ARTICLE_CREATE],
  interview: [PERMISSIONS.ARTICLE_CREATE],
  meddeler: [PERMISSIONS.ARTICLE_CREATE],
  nyhedsbrev: [PERMISSIONS.NEWSLETTER_MANAGE],
  sponsor: [PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_MANAGE, PERMISSIONS.ADS_MANAGE],
  annoncer: [PERMISSIONS.ADS_MANAGE, PERMISSIONS.SUPPORT_MANAGE, PERMISSIONS.SUPPORT_READ],
  metrikker: [PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.ARTICLE_EDIT_ALL],
  omraader: [PERMISSIONS.CATEGORY_MANAGE, PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.ARTICLE_EDIT_ALL],
} as const satisfies Record<string, readonly Permission[]>;

export type RedaktionPage = keyof typeof PAGE_PERMISSIONS;

/** Kampagner må kun ændres med disse (SUPPORT_READ giver kun læseadgang). Bruges af annoncer-actions og -siden. */
export const AD_MANAGE_PERMISSIONS: Permission[] = [PERMISSIONS.ADS_MANAGE, PERMISSIONS.SUPPORT_MANAGE];
/** Områdeadministration (samme model som sektioner). */
export const AREA_PERMISSIONS: Permission[] = [...PAGE_PERMISSIONS.omraader];

export function canAccessPage(user: PermissionUser | null | undefined, page: RedaktionPage): boolean {
  return PAGE_PERMISSIONS[page].some((p) => can(user, p));
}

/** Må brugeren se kildernes kontaktoplysninger og portal-links (tokens)? */
export function canViewSourceDetails(user: PermissionUser | null | undefined): boolean {
  return can(user, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL);
}

/** Må brugeren se partner-/sponsorbriefs (kontaktperson og e-mail hos partneren)? */
export function canViewPartnerBriefs(user: PermissionUser | null | undefined): boolean {
  return can(user, PERMISSIONS.SUPPORT_READ) || can(user, PERMISSIONS.SUPPORT_MANAGE) || can(user, PERMISSIONS.ADS_MANAGE);
}

/** Tekst der vises i stedet for skjulte kontaktoplysninger. */
export const HIDDEN_CONTACT = "Skjult (kræver rettigheden Se fortrolige kilder)";
