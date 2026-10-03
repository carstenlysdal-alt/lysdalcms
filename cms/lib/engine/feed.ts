import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewSourceDetails } from "@/lib/redaktion-access";
import { loadActiveSourceProfiles } from "@/lib/sources/store";
import { toCardScore } from "@/lib/score/present";
import { loadScoreViews } from "@/lib/score/service";
import { keywords, MIN_ARCHIVE_SCORE, overlapScore } from "./archive";
import { rateSource, type SourceProfileLite } from "./source-rating";
import { SIGNAL_ARTICLE_PREFIX, type CardRating, type EngineTab, type FeedCard, type FeedData } from "./types";

const DAY = 86_400_000;
const CARD_LIMIT = 40;
const URGENT_TYPES = new Set(["politi", "beredskab_112"]);

export function excerpt(text: string | null | undefined, max = 220): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const TZ = "Europe/Copenhagen";
const dayKey = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** "kl. 14:22" for i dag, ellers "3. okt. kl. 14:22" (dansk tid). Ren funktion; `now` kan injiceres i tests. */
export function timeLabel(date: Date, now: Date = new Date()): string {
  const hm = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(".", ":");
  if (dayKey(date) === dayKey(now)) return `kl. ${hm}`;
  const day = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, day: "numeric", month: "short" }).format(date);
  return `${day} kl. ${hm}`;
}

function toRating(r: ReturnType<typeof rateSource>): CardRating {
  return { grade: r.grade, score: r.score, label: r.label, begrundelse: r.begrundelse, foelsom: r.foelsom };
}

type FeedParams = { tab: EngineTab; omraade?: string | null; query?: string | null; articleId?: string | null; sort?: "score" | null };

/** Henter feedet til venstre felt i Production Engine. Alt er afgrænset til brugerens aktive by. */
export async function loadFeed(user: AuthorizedUser, params: FeedParams): Promise<FeedData> {
  const instansId = user.instansId;
  const area = params.omraade?.trim() || null;
  const profiles = await loadActiveSourceProfiles(instansId);

  const [omraader, ulaeste, signaler, subs, sager, lastMachine, machine24] = await Promise.all([
    db.geoTag.findMany({ where: { instansId }, select: { slug: true, navn: true }, orderBy: { navn: "asc" }, take: 24 }),
    db.signal.count({ where: { instansId, laest: false } }),
    db.signal.count({ where: { instansId } }),
    db.submission.count({ where: { instansId, status: { in: ["Ny", "Behandles"] } } }),
    db.meddelerSag.count({ where: { instansId, status: { in: ["Ny", "UnderBehandling"] } } }),
    db.signal.findFirst({ where: { instansId, maskinindsamlet: true }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.signal.count({ where: { instansId, maskinindsamlet: true, createdAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);

  let cards: FeedCard[] = [];
  if (params.tab === "feeds") cards = await signalCards(instansId, area, profiles, params.sort === "score");
  else if (params.tab === "tips") cards = await tipCards(user, area, profiles);
  else cards = await loadArchiveMatches(user, { query: params.query, articleId: params.articleId });

  return {
    cards,
    counts: { signaler, ulaeste, tips: subs + sager },
    omraader,
    sync: { sidsteMaskinSignalIso: lastMachine?.createdAt.toISOString() ?? null, maskin24t: machine24 },
  };
}

async function signalCards(instansId: string, area: string | null, profiles: SourceProfileLite[], byScore: boolean): Promise<FeedCard[]> {
  const rows = await db.signal.findMany({
    where: { instansId, ...(area ? { omraade: { slug: area } } : {}) },
    orderBy: { createdAt: "desc" },
    take: CARD_LIMIT,
    include: { omraade: { select: { navn: true } } },
  });
  const started = rows.length
    ? await db.article.findMany({ where: { instansId, externalId: { in: rows.map((r) => `${SIGNAL_ARTICLE_PREFIX}${r.id}`) } }, select: { id: true, externalId: true } })
    : [];
  const articleBySignal = new Map(started.map((a) => [a.externalId!.slice(SIGNAL_ARTICLE_PREFIX.length), a.id]));
  const scores = await loadScoreViews(instansId, rows.map((r) => r.id));
  const cards = rows.map((s): FeedCard => ({
    id: `signal:${s.id}`,
    kind: "signal" as const,
    overskrift: s.overskrift,
    uddrag: excerpt(s.brødtekst),
    kilde: s.kilde,
    kildeUrl: s.kildeUrl && /^https?:\/\//i.test(s.kildeUrl) ? s.kildeUrl : null,
    sourceType: s.sourceType,
    tidIso: (s.kildeTidspunkt ?? s.createdAt).toISOString(),
    tidLabel: timeLabel(s.kildeTidspunkt ?? s.createdAt),
    omraade: s.omraade?.navn ?? s.omraadeTekst ?? null,
    hoej: s.breaking || s.notable || URGENT_TYPES.has(s.sourceType ?? ""),
    breaking: s.breaking,
    notable: s.notable,
    laest: s.laest,
    godkendt: Boolean(s.godkendtTid),
    maskinindsamlet: s.maskinindsamlet,
    rating: toRating(rateSource({ navn: s.kilde, url: s.kildeUrl, sourceType: s.sourceType }, profiles)),
    articleId: articleBySignal.get(s.id) ?? null,
    score: scores.has(s.id) ? toCardScore(scores.get(s.id)!) : null,
  }));
  // Local Score først (højeste øverst), ikke-vurderede bagefter i tidsfølge.
  return byScore ? [...cards].sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1)) : cards;
}

async function tipCards(user: AuthorizedUser, area: string | null, profiles: SourceProfileLite[]): Promise<FeedCard[]> {
  const instansId = user.instansId;
  const showNames = canViewSourceDetails(user);
  const [subs, sager] = await Promise.all([
    db.submission.findMany({
      where: { instansId, status: { in: ["Ny", "Behandles"] }, ...(area ? { omraade: { slug: area } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { omraade: { select: { navn: true } } },
    }),
    db.meddelerSag.findMany({
      where: { instansId, status: { in: ["Ny", "UnderBehandling"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { meddeler: { select: { navn: true, omraader: true } } },
    }),
  ]);
  const areaName = area ? (await db.geoTag.findFirst({ where: { instansId, slug: area }, select: { navn: true } }))?.navn.toLowerCase() : null;
  const borger = toRating(rateSource({ sourceType: "borger" }, profiles));
  const meddeler = toRating(rateSource({ sourceType: "meddeler" }, profiles));

  const fromSubs: FeedCard[] = subs.map((s) => ({
    id: `tip:${s.id}`,
    kind: "borgertip",
    overskrift: s.emne,
    uddrag: excerpt(s.tekst),
    kilde: "Borgertip",
    kildeUrl: null,
    sourceType: "borger",
    tidIso: s.createdAt.toISOString(),
    tidLabel: timeLabel(s.createdAt),
    omraade: s.omraade?.navn ?? null,
    hoej: false,
    breaking: false,
    notable: false,
    laest: s.status !== "Ny",
    godkendt: false,
    maskinindsamlet: false,
    rating: borger,
    articleId: s.articleId,
  }));
  const fromSager: FeedCard[] = sager
    .filter((s) => !areaName || (s.meddeler.omraader ?? "").toLowerCase().includes(areaName))
    .map((s) => ({
      id: `sag:${s.id}`,
      kind: "meddeler" as const,
      overskrift: s.titel,
      uddrag: excerpt(s.tekst),
      // Navnet på en kilde er fortroligt (governance §4): kun med rettigheden "Se fortrolige kilder".
      kilde: showNames ? s.meddeler.navn : "Meddeler",
      kildeUrl: null,
      sourceType: "meddeler",
      tidIso: s.createdAt.toISOString(),
      tidLabel: timeLabel(s.createdAt),
      omraade: s.meddeler.omraader ?? null,
      hoej: false,
      breaking: false,
      notable: false,
      laest: s.status !== "Ny",
      godkendt: false,
      maskinindsamlet: false,
      rating: meddeler,
      articleId: s.articleId,
    }));
  return [...fromSubs, ...fromSager].sort((a, b) => b.tidIso.localeCompare(a.tidIso)).slice(0, CARD_LIMIT);
}

/** Tidligere publicerede artikler med emneoverlap til en tekst (søgeord eller den åbne artikel). */
export async function loadArchiveMatches(user: AuthorizedUser, params: { query?: string | null; articleId?: string | null; take?: number }): Promise<FeedCard[]> {
  const instansId = user.instansId;
  let text = params.query?.trim() ?? "";
  let title = "";
  if (!text && params.articleId) {
    const own = await db.article.findFirst({ where: { id: params.articleId, instansId }, select: { titel: true, manchet: true } });
    if (own) { title = own.titel; text = own.manchet ?? ""; }
  }
  const wanted = keywords(text, title || text);
  if (wanted.length === 0) return [];
  const rows = await db.article.findMany({
    where: { instansId, status: "Publiceret", ...(params.articleId ? { id: { not: params.articleId } } : {}) },
    orderBy: { publiceretTid: "desc" },
    take: 400,
    select: { id: true, titel: true, manchet: true, publiceretTid: true, createdAt: true, tags: { select: { navn: true } }, geoTags: { select: { navn: true } }, kategori: { select: { navn: true } } },
  });
  const archiveRating = toRating(rateSource({ sourceType: "egen" }, await loadActiveSourceProfiles(instansId)));
  return rows
    .map((r) => ({ r, match: overlapScore(wanted, { titel: r.titel, manchet: r.manchet, tags: r.tags.map((t) => t.navn) }) }))
    .filter((x) => x.match >= MIN_ARCHIVE_SCORE)
    .sort((a, b) => b.match - a.match)
    .slice(0, params.take ?? 8)
    .map(({ r, match }) => ({
      id: `arkiv:${r.id}`,
      kind: "arkiv" as const,
      overskrift: r.titel,
      uddrag: excerpt(r.manchet),
      kilde: r.kategori?.navn ?? "Arkiv",
      kildeUrl: null,
      sourceType: "egen",
      tidIso: (r.publiceretTid ?? r.createdAt).toISOString(),
      tidLabel: timeLabel(r.publiceretTid ?? r.createdAt),
      omraade: r.geoTags[0]?.navn ?? null,
      hoej: false,
      breaking: false,
      notable: false,
      laest: true,
      godkendt: false,
      maskinindsamlet: false,
      rating: archiveRating,
      articleId: r.id,
      match,
    }));
}
