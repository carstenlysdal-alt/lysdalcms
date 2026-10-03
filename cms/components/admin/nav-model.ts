import { can, PERMISSIONS, type PermissionUser } from "@/lib/permissions";
import { canAccessPage, canViewPartnerBriefs } from "@/lib/redaktion-access";

/**
 * Redaktionens navigation som DATA (serialiserbar), så layoutet (server) kan filtrere efter brugerens rettigheder
 * og sende resultatet til den klient-komponent der tegner sidebar, drawer og bundnavigation.
 * Linjen følger sidernes egen adgangskontrol (PAGE_PERMISSIONS + de rettigheder siderne selv slår op); skjulte links
 * giver ikke ekstra beskyttelse — siderne viser stadig NoAccess, og server actions tjekker igen.
 *
 * Tilføj en side: tilføj et punkt i NAV_GROUPS med `allowed` (samme regel som siden) og ikon-nøglen i nav-icons.tsx.
 */
export type NavIconKey =
  | "articles" | "write" | "media" | "tasks" | "fee" | "chat"
  | "engine" | "control" | "grundlag" | "prompts" | "ratings" | "feeds" | "ingest"
  | "inbox" | "qa" | "signals" | "sources" | "interview"
  | "analytics" | "newsletter" | "ads" | "sponsor"
  | "sections" | "areas" | "topics" | "frontpage"
  | "users" | "operator" | "account";

export type NavBadgeKey = "inbox";

type NavItemDef = {
  href: string;
  label: string;
  icon: NavIconKey;
  allowed: (user: PermissionUser) => boolean;
  badge?: NavBadgeKey;
  /** Kortere navn til mobilens bundnavigation (smal plads). */
  shortLabel?: string;
  /** Match kun præcis denne sti (ellers præfiks) — bruges når en anden menu-linje ligger under samme præfiks. */
  exact?: boolean;
};

type NavGroupDef = { id: string; label: string; items: NavItemDef[] };

const anyOf = (...perms: Parameters<typeof can>[1][]) => (user: PermissionUser) => perms.some((p) => can(user, p));
const everyone = () => true;

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "content",
    label: "Indhold",
    items: [
      { href: "/redaktion/engine", label: "Production Engine", shortLabel: "Engine", icon: "engine", allowed: (u) => canAccessPage(u, "engine") },
      { href: "/redaktion/artikler", label: "Artikler", icon: "articles", allowed: everyone, exact: true },
      { href: "/redaktion/artikler/ny", label: "Opret artikel", icon: "write", allowed: anyOf(PERMISSIONS.ARTICLE_CREATE), exact: true },
      { href: "/redaktion/medier", label: "Medier", icon: "media", allowed: everyone },
      { href: "/redaktion/opgaver", label: "Opgaver", icon: "tasks", allowed: everyone },
      { href: "/redaktion/honorar", label: "Honorar", icon: "fee", allowed: anyOf(PERMISSIONS.HONORAR_VIEW, PERMISSIONS.HONOR_VIEW_OWN, PERMISSIONS.HONOR_MANAGE) },
      { href: "/redaktion/chat", label: "AI-assistent", icon: "chat", allowed: everyone },
    ],
  },
  {
    id: "inbox",
    label: "Indbakke",
    items: [
      { href: "/redaktion/indbakke", label: "Indbakke", icon: "inbox", allowed: (u) => canAccessPage(u, "indbakke"), badge: "inbox" },
      { href: "/redaktion/qa", label: "Kilde-Q&A", icon: "qa", allowed: (u) => canAccessPage(u, "qa") },
      { href: "/redaktion/signaler", label: "Signaler", icon: "signals", allowed: everyone },
      { href: "/redaktion/meddeler", label: "Meddelere", icon: "sources", allowed: (u) => canAccessPage(u, "meddeler") },
      { href: "/redaktion/interview", label: "Interview", icon: "interview", allowed: (u) => canAccessPage(u, "interview") },
    ],
  },
  {
    id: "growth",
    label: "Vækst",
    items: [
      { href: "/redaktion/metrikker", label: "Analytics", icon: "analytics", allowed: (u) => canAccessPage(u, "metrikker") },
      { href: "/redaktion/nyhedsbrev", label: "Nyhedsbrev", icon: "newsletter", allowed: (u) => canAccessPage(u, "nyhedsbrev") },
      { href: "/redaktion/annoncer", label: "Annoncer", icon: "ads", allowed: (u) => canAccessPage(u, "annoncer") },
      { href: "/redaktion/sponsor", label: "Sponsor", icon: "sponsor", allowed: (u) => canAccessPage(u, "sponsor") },
    ],
  },
  {
    id: "structure",
    label: "Struktur",
    items: [
      { href: "/redaktion/sektioner", label: "Sektioner", icon: "sections", allowed: anyOf(PERMISSIONS.CATEGORY_MANAGE, PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.ARTICLE_EDIT_ALL) },
      { href: "/redaktion/omraader", label: "Områder", icon: "areas", allowed: (u) => canAccessPage(u, "omraader") },
      { href: "/redaktion/emner", label: "Emner", icon: "topics", allowed: everyone },
      { href: "/redaktion/forside", label: "Forside", icon: "frontpage", allowed: anyOf(PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE) },
    ],
  },
  {
    id: "control",
    label: "Kontrolrum",
    items: [
      { href: "/redaktion/kontrolrum", label: "Oversigt", icon: "control", allowed: (u) => canAccessPage(u, "kontrolrum"), exact: true },
      { href: "/redaktion/kontrolrum/grundlag", label: "AI-grundlag", icon: "grundlag", allowed: anyOf(PERMISSIONS.CONTROLROOM_MANAGE) },
      { href: "/redaktion/kontrolrum/prompts", label: "Prompts", icon: "prompts", allowed: anyOf(PERMISSIONS.CONTROLROOM_MANAGE) },
      { href: "/redaktion/kontrolrum/kilder", label: "Kilder og rating", icon: "ratings", allowed: anyOf(PERMISSIONS.CONTROLROOM_MANAGE) },
      { href: "/redaktion/kontrolrum/feeds", label: "Kildepakke", icon: "feeds", allowed: anyOf(PERMISSIONS.CONTROLROOM_MANAGE) },
      { href: "/redaktion/kontrolrum/ingest", label: "Ingest", icon: "ingest", allowed: anyOf(PERMISSIONS.INGEST_MANAGE) },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [{ href: "/redaktion/brugere", label: "Brugere", icon: "users", allowed: anyOf(PERMISSIONS.USERS_MANAGE) }],
  },
];

/** Hurtigvalg i bundnavigationen (mobil), i prioriteret rækkefølge — de første fire de må se; femte plads er "Mere". */
export const BOTTOM_NAV_PREFERENCE = ["/redaktion/engine", "/redaktion/artikler", "/redaktion/indbakke", "/redaktion/forside", "/redaktion/metrikker", "/redaktion/medier"];

export type NavItem = { href: string; label: string; shortLabel?: string; icon: NavIconKey; badge?: number; exact?: boolean };
export type NavGroup = { id: string; label: string; items: NavItem[] };

/** Filtrér navigationen efter rettigheder. Tomme grupper udelades. */
export function buildNav(user: PermissionUser, counts: Partial<Record<NavBadgeKey, number>> = {}): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items
      .filter((item) => item.allowed(user))
      .map((item) => ({ href: item.href, label: item.label, shortLabel: item.shortLabel, icon: item.icon, exact: item.exact, badge: item.badge ? counts[item.badge] || undefined : undefined })),
  })).filter((group) => group.items.length > 0);
}

/** De fire (højst) hovedpunkter til bundnavigationen. */
export function bottomNavItems(groups: NavGroup[]): NavItem[] {
  const flat = groups.flatMap((g) => g.items);
  const out: NavItem[] = [];
  for (const href of BOTTOM_NAV_PREFERENCE) {
    const hit = flat.find((i) => i.href === href);
    if (hit) out.push(hit);
    if (out.length === 4) break;
  }
  return out;
}

/** Hvilket punkt er aktivt for stien? Længste matchende præfiks vinder, `exact` kræver præcis match. */
export function activeHref(items: Array<{ href: string; exact?: boolean }>, path: string): string | null {
  let best: string | null = null;
  for (const item of items) {
    const match = item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
    if (match && (!best || item.href.length > best.length)) best = item.href;
  }
  // "Artikler" er exact (så "Opret artikel" kan have sin egen) — men artikel-redigering (/artikler/<id>) hører under Artikler.
  if (!best && path.startsWith("/redaktion/artikler/") && items.some((i) => i.href === "/redaktion/artikler")) return "/redaktion/artikler";
  return best;
}

/** Må brugeren se "Operator"-linjen i brugermenuen? (Selve værktøjerne tjekker rettigheder igen.) */
export function canSeeOperator(user: PermissionUser): boolean {
  return can(user, PERMISSIONS.OPERATOR_USE);
}

/** Skal partner-/sponsorindhold tælles med i indbakke-badgen? (samme regel som indbakke-siden) */
export function countsPartnerBriefs(user: PermissionUser): boolean {
  return canViewPartnerBriefs(user);
}
