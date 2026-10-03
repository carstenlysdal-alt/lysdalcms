import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { articleMetaSchema, metaToDb } from "@/lib/article-meta";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { slugify } from "@/lib/slug";
import { cleanText } from "@/lib/validation/text";
import { MAX_EXCERPT_CHARS } from "@/lib/ai/editorial-schemas";
import { SIGNAL_ARTICLE_PREFIX } from "./types";

/**
 * Starter en historie ud fra et signal. Opretter en KLADDE (status "Idé") med signalet som første kilde, inkl. uddrag, så tal og
 * citater kan kontrolleres mod originalen. Signalets tekst kopieres IKKE ind i brødteksten: redaktøren skriver selv historien.
 * Idempotent: samme signal giver altid samme artikel (Article.externalId = "engine:signal:<id>").
 */
export type StartResult = { ok: true; articleId: string; findesAllerede: boolean } | { ok: false; error: string };

/** Kategori-slugs der passer til kildetypen, i prioriteret rækkefølge. Politi/112 lægges i Krimi, så AI-tekstforslag er spærret. */
const CATEGORY_BY_TYPE: Record<string, string[]> = {
  politi: ["krimi-og-retsvaesen", "112"],
  beredskab_112: ["112", "krimi-og-retsvaesen"],
  kommune_dagsorden: ["politik", "nyheder"],
  kommune_pressemeddelelse: ["politik", "nyheder"],
  trafik: ["nyheder"],
  vejr: ["nyheder"],
  forening: ["foreningsliv", "kultur", "nyheder"],
  klub: ["foreningsliv", "kultur", "nyheder"],
};

export function categorySlugsFor(sourceType: string | null | undefined): string[] {
  return CATEGORY_BY_TYPE[sourceType ?? ""] ?? ["nyheder"];
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base, 70) || "ny-historie";
  let slug = root;
  for (let i = 2; await db.article.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${root}-${i}`;
  return slug;
}

export async function startArticleFromSignal(user: AuthorizedUser, signalId: string): Promise<StartResult> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return { ok: false, error: "Du har ikke rettigheder til at oprette artikler." };
  const instansId = user.instansId;
  const signal = await db.signal.findFirst({ where: { id: String(signalId), instansId } });
  if (!signal) return { ok: false, error: "Signalet findes ikke." };

  const externalId = `${SIGNAL_ARTICLE_PREFIX}${signal.id}`;
  const existing = await db.article.findUnique({ where: { instansId_externalId: { instansId, externalId } }, select: { id: true } });
  if (existing) return { ok: true, articleId: existing.id, findesAllerede: true };

  const categories = await db.category.findMany({ where: { instansId, slug: { in: categorySlugsFor(signal.sourceType) } }, select: { id: true, slug: true } });
  const wanted = categorySlugsFor(signal.sourceType);
  const category = wanted.map((s) => categories.find((c) => c.slug === s)).find(Boolean) ?? null;

  const date = (signal.kildeTidspunkt ?? signal.createdAt).toISOString().slice(0, 10);
  const kilde = {
    titel: signal.overskrift.slice(0, 200),
    url: signal.kildeUrl && /^https?:\/\//i.test(signal.kildeUrl) ? signal.kildeUrl : undefined,
    udgiver: signal.kilde.slice(0, 120),
    dato: date,
    uddrag: cleanText(signal.brødtekst ?? "", MAX_EXCERPT_CHARS, { multiline: true }) || undefined,
    type: signal.sourceType ?? undefined,
  };
  // Et signal kan bære en kilde-URL, som metadata-skemaet afviser. Så starter historien uden URL frem for at fejle (titel og uddrag bevares).
  const meta = (() => {
    for (const candidate of [kilde, { ...kilde, url: undefined }]) {
      const parsed = articleMetaSchema.safeParse({ kilder: [candidate] });
      if (parsed.success) return parsed.data;
    }
    return articleMetaSchema.parse({});
  })();

  const slug = await uniqueSlug(signal.overskrift);
  try {
    const article = await db.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          titel: signal.overskrift.slice(0, 300),
          slug,
          blocks: [{ id: "initial-paragraph", type: "paragraph", data: { content: "" } }],
          status: "Idé",
          indholdstype: "Uafhængig",
          aiBrug: [],
          kategoriId: category?.id ?? null,
          forfatterId: user.authorId,
          instansId,
          externalId,
          provenance: { via: "production-engine", signalIds: [signal.id] },
          geoTags: signal.omraadeId ? { connect: [{ id: signal.omraadeId }] } : undefined,
        },
      });
      await tx.articleMeta.create({ data: { ...(metaToDb(meta) as object), articleId: created.id, instansId } as never });
      await tx.signal.update({ where: { id: signal.id }, data: { laest: true } });
      await writeAudit(tx, { instansId, actorId: user.id, actorLabel: user.name, action: "engine.start", targetId: created.id, targetLabel: "Historie fra signal", detail: { signalId: signal.id } });
      return created;
    });
    return { ok: true, articleId: article.id, findesAllerede: false };
  } catch (error) {
    // Samtidigt klik fra to faner: den anden vinder på unikt externalId. Returnér den vindende artikel.
    const raced = await db.article.findUnique({ where: { instansId_externalId: { instansId, externalId } }, select: { id: true } });
    if (raced) return { ok: true, articleId: raced.id, findesAllerede: true };
    console.error("[engine] kunne ikke starte historie fra signal", error instanceof Error ? error.message : "ukendt");
    return { ok: false, error: "Historien kunne ikke oprettes. Prøv igen." };
  }
}
