/**
 * Genererer lib/feeds/catalog-data.ts ud fra kilderegistrene i docs/localrating/source-registries.
 * Kør:  npx tsx scripts/gen-feed-catalog.ts
 * Kataloget er råmateriale (kilde, område, adgang, brug) uden adresser. Importen i kontrolrummet gør dem til inaktive
 * feed-kladder, som redaktionen selv udfylder med adresser og slår til.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.resolve(ROOT, "../docs/localrating/source-registries");
const PACKS = [
  { id: "slagelse", navn: "Slagelse, Korsør og Skælskør", fil: "Slagelse_Source_Registry_Artikelmotor.md" },
  { id: "naestved", navn: "Næstved og lokale bysamfund", fil: "Naestved_Source_Registry_Artikelmotor.md" },
];

type Row = { pri: 0 | 1 | 2; kilde: string; omraade: string; adgang: string; filter: string | null; brug: string };

function parse(markdown: string): Row[] {
  const rows: Row[] = [];
  for (const line of markdown.split("\n")) {
    if (!/^\| P[0-2] \|/.test(line)) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const pri = Number(cells[0].slice(1)) as 0 | 1 | 2;
    // Slagelse: Pri | Kilde | Område | Adgang | Brug.  Næstved: Pri | Kilde | Område | Adgang | Lokal filtrering | Typiske historier.
    const six = cells.length >= 6;
    rows.push({ pri, kilde: cells[1], omraade: cells[2], adgang: cells[3], filter: six ? cells[4] : null, brug: six ? cells[5] : cells[4] });
  }
  return rows;
}

const out = PACKS.map((p) => ({ id: p.id, navn: p.navn, rows: parse(readFileSync(path.join(DOCS, p.fil), "utf8")) }));
const body = `/* GENERERET af scripts/gen-feed-catalog.ts fra docs/localrating/source-registries. Redigér ikke i hånden. */
import type { CatalogPack } from "./catalog";

export const CATALOG_PACKS: readonly CatalogPack[] = ${JSON.stringify(out, null, 2)};
`;
writeFileSync(path.join(ROOT, "lib/feeds/catalog-data.ts"), body);
console.log(out.map((p) => `${p.id}: ${p.rows.length} kilder`).join(", "));
