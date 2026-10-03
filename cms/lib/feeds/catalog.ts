/**
 * Kildekatalog: de to kilderegistre (Slagelse og Næstved) som færdige kladder, man kan hente ind i en by.
 * RENT. Kataloget indeholder ingen adresser; en importeret kilde er et INAKTIVT feed uden URL, til redaktionen har udfyldt og tjekket det.
 */
import type { FeedInput, FeedType } from "./input";
import { cleanText } from "@/lib/validation/text";
import { CATALOG_PACKS } from "./catalog-data";

export type CatalogRow = { pri: 0 | 1 | 2; kilde: string; omraade: string; adgang: string; filter: string | null; brug: string };
export type CatalogPack = { id: string; navn: string; rows: CatalogRow[] };

export { CATALOG_PACKS };
export const getCatalogPack = (id: string): CatalogPack | undefined => CATALOG_PACKS.find((p) => p.id === id);

/** P0 = 10 min (drift/breaking), P1 = 1 time, P2 = 12 timer. Vejledende: CMS'et henter kun, når en redaktør beder om det. */
const INTERVAL_BY_PRI = [10, 60, 720] as const;

export function feedTypeForAccess(adgang: string): FeedType {
  const a = adgang.toLowerCase();
  if (/\brss\b|atom/.test(a)) return "rss";
  if (/^(api|rest|odata|openapi|wfs|officiel api)/.test(a) || /\bapi\b/.test(a)) return "api";
  if (/^mail/.test(a)) return "mail";
  return "web";
}

export function sourceTypeForArea(omraade: string, kilde: string): string {
  const o = omraade.toLowerCase();
  const k = kilde.toLowerCase();
  if (o.startsWith("politi")) return "politi";
  if (o.startsWith("beredskab")) return "beredskab_112";
  if (/^(trafik|jernbane|kollektiv|bus|færger|infrastruktur)/.test(o)) return "trafik";
  if (o.startsWith("vejr")) return "vejr";
  if (/medie|aggregator|lokal portal/.test(o)) return "lokalt_medie";
  if (/^(forening|sport|kultur|kunst)/.test(o)) return "forening";
  if (o === "kommunalpolitik" || /dagsorden|referat/.test(k)) return "kommune_dagsorden";
  if (o === "kommune" || /pressemeddelelse/.test(o)) return "kommune_pressemeddelelse";
  return "andet";
}

/** Erstat by-navn i tekstfelter (uden hensyn til store/små bogstaver). Adresser rører vi aldrig. */
export function replaceName(text: string, from: string, to: string): string {
  const f = from.trim();
  if (!f || !to.trim() || f.toLowerCase() === to.trim().toLowerCase()) return text;
  return text.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => (m === m.toUpperCase() && m.length > 1 ? to.toUpperCase() : to));
}

export function catalogRowToFeed(row: CatalogRow, opts: { replace?: { from: string; to: string } } = {}): FeedInput {
  const r = (s: string) => (opts.replace ? replaceName(s, opts.replace.from, opts.replace.to) : s);
  return {
    navn: cleanText(r(row.kilde), 80),
    type: feedTypeForAccess(row.adgang),
    url: null,
    sourceType: sourceTypeForArea(row.omraade, row.kilde),
    omraadeTekst: row.filter ? cleanText(r(row.filter), 120) || null : null,
    inkluder: [],
    ekskluder: [],
    intervalMin: INTERVAL_BY_PRI[row.pri],
    aktiv: false,
    noter: cleanText(`${r(row.brug)}${row.adgang ? ` Adgang: ${row.adgang}.` : ""}`, 300, { multiline: true }) || null,
    kategori: cleanText(row.omraade, 60) || null,
    prioritet: row.pri + 1,
  };
}
