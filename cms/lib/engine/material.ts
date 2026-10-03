import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { parseBlocks } from "@/lib/blocks/schema";
import { blocksPlainText } from "@/lib/blocks/text";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { rateLimit } from "@/lib/ratelimit";
import { searchOr } from "@/lib/search";
import { absoluteUrl, articlePath, siteBase } from "@/lib/seo/url";
import { cleanText } from "@/lib/validation/text";
import { MAX_EXCERPT_CHARS } from "@/lib/ai/editorial-schemas";
import { excerpt } from "./feed";
import type { MaterialKind, SearchHit, SearchResult, SourceDraft } from "./types";

const PER_KIND = 6;

/** Søger i alt materiale, redaktionen allerede har: egne artikler, signaler, tip, meddelersager og emner. Kun for den aktive by. */
export async function searchMaterial(user: AuthorizedUser, rawQuery: string): Promise<SearchResult> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return { ok: false, error: "Du har ikke adgang til materialesøgning." };
  const query = cleanText(rawQuery, 100);
  if (query.length < 2) return { ok: false, error: "Skriv mindst 2 tegn for at søge." };
  const limited = await rateLimit({ bucket: "engine-search", key: `${user.instansId}:${user.id}`, limit: 40, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: `For mange søgninger. Prøv igen om ${limited.retryAfterSec} sekunder.` };

  const instansId = user.instansId;
  const [artikler, signaler, tips, sager, emner] = await Promise.all([
    db.article.findMany({ where: { instansId, OR: searchOr(["titel", "manchet"], query) }, orderBy: { opdateretTid: "desc" }, take: PER_KIND, select: { id: true, titel: true, manchet: true, status: true, opdateretTid: true } }),
    db.signal.findMany({ where: { instansId, OR: searchOr(["overskrift", "brødtekst"], query) }, orderBy: { createdAt: "desc" }, take: PER_KIND }),
    db.submission.findMany({ where: { instansId, OR: searchOr(["emne", "tekst"], query) }, orderBy: { createdAt: "desc" }, take: PER_KIND, select: { id: true, emne: true, tekst: true, status: true, createdAt: true } }),
    db.meddelerSag.findMany({ where: { instansId, OR: searchOr(["titel", "tekst"], query) }, orderBy: { createdAt: "desc" }, take: PER_KIND, select: { id: true, titel: true, tekst: true, status: true, createdAt: true } }),
    db.topic.findMany({ where: { instansId, OR: searchOr(["titel", "beskrivelse"], query) }, orderBy: { updatedAt: "desc" }, take: 4, select: { id: true, titel: true, beskrivelse: true, updatedAt: true } }),
  ]);

  const hits: SearchHit[] = [
    ...artikler.map((a): SearchHit => ({ id: `artikel:${a.id}`, kind: "artikel", titel: a.titel, uddrag: excerpt(a.manchet, 160), tidIso: a.opdateretTid.toISOString(), meta: `Artikel · ${a.status}`, kanBruges: a.status === "Publiceret", href: `/redaktion/artikler?id=${a.id}` })),
    ...signaler.map((s): SearchHit => ({ id: `signal:${s.id}`, kind: "signal", titel: s.overskrift, uddrag: excerpt(s.brødtekst, 160), tidIso: s.createdAt.toISOString(), meta: `Signal · ${s.kilde}`, kanBruges: true, href: "/redaktion/signaler" })),
    ...tips.map((t): SearchHit => ({ id: `tip:${t.id}`, kind: "tip", titel: t.emne, uddrag: excerpt(t.tekst, 160), tidIso: t.createdAt.toISOString(), meta: `Borgertip · ${t.status}`, kanBruges: false, href: "/redaktion/indbakke" })),
    ...sager.map((s): SearchHit => ({ id: `sag:${s.id}`, kind: "sag", titel: s.titel, uddrag: excerpt(s.tekst, 160), tidIso: s.createdAt.toISOString(), meta: `Meddelersag · ${s.status}`, kanBruges: false, href: "/redaktion/indbakke" })),
    ...emner.map((e): SearchHit => ({ id: `emne:${e.id}`, kind: "emne", titel: e.titel, uddrag: excerpt(e.beskrivelse, 160), tidIso: e.updatedAt.toISOString(), meta: "Emne", kanBruges: false, href: "/redaktion/emner" })),
  ];
  return { ok: true, hits, query };
}

const KINDS: readonly MaterialKind[] = ["artikel", "signal"];

/** Gør et søgetræf eller feedkort til en kilde på artiklen (med uddrag). Kun signaler og publicerede egne artikler kan bruges. */
export async function sourceFromMaterial(user: AuthorizedUser, ref: string): Promise<{ ok: true; kilde: SourceDraft } | { ok: false; error: string }> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return { ok: false, error: "Du har ikke adgang." };
  const [kind, id] = String(ref).split(":");
  const instansId = user.instansId;
  if (!id || !(KINDS as readonly string[]).includes(kind === "arkiv" ? "artikel" : kind)) return { ok: false, error: "Det kan ikke bruges som kilde." };

  if (kind === "signal") {
    const s = await db.signal.findFirst({ where: { id, instansId } });
    if (!s) return { ok: false, error: "Signalet findes ikke." };
    return {
      ok: true,
      kilde: {
        titel: s.overskrift.slice(0, 200),
        url: s.kildeUrl && /^https?:\/\//i.test(s.kildeUrl) ? s.kildeUrl : null,
        udgiver: s.kilde.slice(0, 120),
        dato: (s.kildeTidspunkt ?? s.createdAt).toISOString().slice(0, 10),
        uddrag: cleanText(s.brødtekst ?? "", MAX_EXCERPT_CHARS, { multiline: true }) || null,
        type: s.sourceType ?? null,
      },
    };
  }

  const a = await db.article.findFirst({ where: { id, instansId, status: "Publiceret" }, include: { kategori: { select: { slug: true, parent: { select: { slug: true } } } }, instans: { select: { domaene: true, navn: true } } } });
  if (!a) return { ok: false, error: "Kun publicerede artikler kan bruges som kilde." };
  const sektion = a.kategori?.parent?.slug ?? a.kategori?.slug ?? "nyheder";
  let text = "";
  try { text = blocksPlainText(parseBlocks(a.blocks)); } catch { text = ""; }
  return {
    ok: true,
    kilde: {
      titel: a.titel.slice(0, 200),
      url: absoluteUrl(siteBase(a.instans), articlePath(sektion, a.slug)),
      udgiver: a.instans.navn.slice(0, 120),
      dato: (a.publiceretTid ?? a.createdAt).toISOString().slice(0, 10),
      uddrag: cleanText(text, MAX_EXCERPT_CHARS, { multiline: true }) || null,
      type: "egen",
    },
  };
}
