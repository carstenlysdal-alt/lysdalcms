/**
 * Udtræk af brugbart materiale fra en webside, en PDF eller indsat tekst. RENT og uden netværk: kalderne henter selv bytes.
 * Billeder hentes ALDRIG herfra: vi gemmer kun adresse, alt-tekst og billedtekst som reference, så rettigheder kan afklares først.
 */
import * as cheerio from "cheerio";
import { extractText, getDocumentProxy } from "unpdf";
import type { ImageRef } from "./types";
import { LIMITS } from "./types";

export type ExtractedPage = {
  titel: string;
  udgiver: string | null;
  forfatter: string | null;
  dato: string | null;
  beskrivelse: string | null;
  tekst: string;
  billeder: ImageRef[];
  canonical: string | null;
};

const TEXT_CAP = 60_000;
const IMAGE_CAP = 8;
const NOISE = "script,style,noscript,template,iframe,svg,form,nav,aside,footer,header[role=banner],[role=navigation],[aria-hidden=true],.cookie,.cookies,#cookie,.consent,.advertisement,.ad,.share,.social";

/** Dansk-venlig tekstrensning: kontroltegn væk, ensartede mellemrum, højst to linjeskift i træk. */
export function cleanSourceText(input: string, max = TEXT_CAP): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‍﻿]/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const isoDay = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  return year >= 1990 && year <= new Date().getUTCFullYear() + 1 ? d.toISOString().slice(0, 10) : null;
};

const httpAbs = (raw: string | undefined, base: string): string | null => {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
};

function jsonLdDate(html: cheerio.CheerioAPI): string | null {
  let found: string | null = null;
  html('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const data = JSON.parse(html(el).text()) as unknown;
      const stack: unknown[] = Array.isArray(data) ? [...data] : [data];
      while (stack.length && !found) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        const o = node as Record<string, unknown>;
        if (typeof o.datePublished === "string") found = isoDay(o.datePublished);
        for (const v of Object.values(o)) if (v && typeof v === "object") stack.push(v);
      }
    } catch {
      /* ugyldig JSON-LD ignoreres */
    }
  });
  return found;
}

export function extractArticleFromHtml(html: string, baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);
  const meta = (sel: string) => $(sel).first().attr("content")?.trim() || null;

  const host = (() => { try { return new URL(baseUrl).hostname.replace(/^www\./, ""); } catch { return null; } })();
  const titel = (meta('meta[property="og:title"]') ?? ($("article h1, main h1, h1").first().text().trim() || $("title").first().text().trim()) ?? "").replace(/\s+/g, " ").slice(0, 300);
  const udgiver = meta('meta[property="og:site_name"]') ?? meta('meta[name="application-name"]') ?? host;
  const forfatter = meta('meta[name="author"]') ?? meta('meta[property="article:author"]');
  const dato = isoDay(meta('meta[property="article:published_time"]') ?? meta('meta[name="date"]') ?? meta('meta[name="pubdate"]') ?? meta('meta[name="DC.date"]') ?? meta('meta[itemprop="datePublished"]') ?? $("article time[datetime], main time[datetime], time[datetime]").first().attr("datetime")) ?? jsonLdDate($);
  const beskrivelse = meta('meta[property="og:description"]') ?? meta('meta[name="description"]');
  const canonical = httpAbs($('link[rel="canonical"]').attr("href"), baseUrl);

  $(NOISE).remove();
  const containerSel = ['[itemprop="articleBody"]', "article", "main", '[role="main"]', "#content", ".content", "body"].find((sel) => $(sel).length > 0 && $(sel).first().text().trim().length > 200) ?? "body";
  const container = $(containerSel).first();

  const lines: string[] = [];
  container.find("h1,h2,h3,p,li,blockquote,figcaption").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    const tag = (el as unknown as { tagName?: string }).tagName?.toLowerCase() ?? "p";
    if (!t) return;
    if (tag === "figcaption") return;
    if (/^h[1-3]$/.test(tag)) lines.push(t);
    else if (t.length >= 40 || tag === "blockquote") lines.push(t);
  });
  // Fjern gentagne linjer (menuer, gentagne bokse)
  const seen = new Set<string>();
  const uniq = lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
  const tekst = cleanSourceText(uniq.join("\n\n"));

  const images: ImageRef[] = [];
  const pushImage = (src: string | undefined, alt: string | null, caption: string | null) => {
    const url = httpAbs(src, baseUrl);
    if (!url || images.some((i) => i.url === url) || images.length >= IMAGE_CAP) return;
    if (/logo|icon|sprite|avatar|pixel|tracking|favicon|banner-ad|\.svg(\?|$)|\.gif(\?|$)/i.test(url)) return;
    images.push({ url, alt: alt?.replace(/\s+/g, " ").trim().slice(0, 300) || null, billedtekst: caption?.replace(/\s+/g, " ").trim().slice(0, 400) || null });
  };
  pushImage(meta('meta[property="og:image"]') ?? undefined, meta('meta[property="og:image:alt"]'), null);
  pushImage(meta('meta[name="twitter:image"]') ?? undefined, meta('meta[name="twitter:image:alt"]'), null);
  container.find("figure").each((_, fig) => {
    const img = $(fig).find("img").first();
    pushImage(img.attr("src") ?? img.attr("data-src"), img.attr("alt") ?? null, $(fig).find("figcaption").first().text());
  });
  container.find("img").each((_, el) => {
    const w = Number($(el).attr("width"));
    if (Number.isFinite(w) && w > 0 && w < 200) return;
    pushImage($(el).attr("src") ?? $(el).attr("data-src"), $(el).attr("alt") ?? null, null);
  });

  return { titel, udgiver, forfatter, dato, beskrivelse, tekst, billeder: images, canonical };
}

export type ExtractedPdf = { ok: true; tekst: string; sider: number; afkortet: boolean; titel: string | null } | { ok: false; error: string };

/** Kun ægte PDF'er (magic bytes), højst 10 MB og 60 sider. Billed-PDF'er uden tekstlag afvises med en forklaring. */
export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdf> {
  if (bytes.length === 0) return { ok: false, error: "Filen er tom." };
  if (bytes.length > LIMITS.pdfBytes) return { ok: false, error: "PDF'en er større end 10 MB." };
  const head = Buffer.from(bytes.subarray(0, 8)).toString("latin1");
  if (!head.startsWith("%PDF-")) return { ok: false, error: "Filen er ikke en PDF." };
  try {
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    const total = doc.numPages;
    const { text } = await extractText(doc, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).slice(0, LIMITS.maxPdfPages);
    const tekst = cleanSourceText(pages.join("\n\n"));
    if (tekst.length < LIMITS.minSourceChars) return { ok: false, error: "PDF'en har intet tekstlag (fx en scannet side). Kopiér teksten ind som tekstkilde." };
    const first = tekst.split("\n").find((l) => l.trim().length >= 8)?.trim().slice(0, 160) ?? null;
    return { ok: true, tekst, sider: total, afkortet: total > LIMITS.maxPdfPages, titel: first };
  } catch {
    return { ok: false, error: "PDF'en kunne ikke læses. Den kan være beskyttet eller beskadiget." };
  }
}

/** Dekod bytes med det tegnsæt, siden angiver (header eller meta), ellers UTF-8. Latin-1/Windows-1252 er almindeligt på ældre sider. */
export function decodeBody(body: Uint8Array, headerCharset: string | null): string {
  const sniff = Buffer.from(body.subarray(0, 2048)).toString("latin1");
  const metaCharset = sniff.match(/<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i)?.[1]?.toLowerCase() ?? null;
  const label = (headerCharset ?? metaCharset ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(label === "iso-8859-1" || label === "latin1" ? "windows-1252" : label).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}
