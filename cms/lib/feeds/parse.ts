/**
 * RSS/Atom/JSON Feed til ensartede elementer. RENT (ingen netværk). Opfylder S22: feeds med <!ENTITY> afvises, og
 * DOCTYPE fjernes, så der hverken kan komme eksterne enheder eller "billion laughs" ind. Links hentes aldrig herfra (S16).
 */
import { XMLParser } from "fast-xml-parser";
import { htmlToText } from "../text/html-text";

export type FeedItem = {
  /** Feedets eget id (guid/id), ellers linket. */
  id: string;
  titel: string;
  url: string | null;
  tekst: string;
  dato: Date | null;
  kategorier: string[];
};
export type ParsedFeedContent = { ok: true; titel: string | null; items: FeedItem[] } | { ok: false; error: string };

export const MAX_ITEMS = 40;
const SUMMARY_MAX = 1500;

const arr = <T,>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return text(o["#text"] ?? o["__cdata"] ?? "");
  }
  return "";
};
const date = (v: unknown): Date | null => {
  const s = text(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const httpOnly = (v: string): string | null => (/^https?:\/\//i.test(v.trim()) ? v.trim().slice(0, 2048) : null);
const clean = (html: string) => htmlToText(html, SUMMARY_MAX);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", cdataPropName: "__cdata", processEntities: true, htmlEntities: true, trimValues: true });

function atomLink(link: unknown): string | null {
  const links = arr(link as Record<string, string> | Record<string, string>[]);
  const alt = links.find((l) => typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate")) ?? links[0];
  if (!alt) return null;
  return httpOnly(typeof alt === "string" ? alt : String(alt["@_href"] ?? ""));
}

function fromJsonFeed(json: Record<string, unknown>): ParsedFeedContent {
  const items = arr(json.items as Array<Record<string, unknown>>).slice(0, MAX_ITEMS).map((it): FeedItem => {
    const url = httpOnly(text(it.url));
    return {
      id: text(it.id) || url || text(it.title),
      titel: text(it.title).trim().slice(0, 300),
      url,
      tekst: clean(text(it.summary) || text(it.content_text) || text(it.content_html)),
      dato: date(it.date_published ?? it.date_modified),
      kategorier: arr(it.tags as string[]).map(String).slice(0, 8),
    };
  });
  return { ok: true, titel: text(json.title) || null, items: items.filter((i) => i.titel && i.id) };
}

export function parseFeedContent(raw: string): ParsedFeedContent {
  const body = raw.replace(/^﻿/, "").trim();
  if (!body) return { ok: false, error: "Feedet er tomt." };
  if (body.startsWith("{")) {
    try {
      return fromJsonFeed(JSON.parse(body) as Record<string, unknown>);
    } catch {
      return { ok: false, error: "Feedet kunne ikke læses." };
    }
  }
  if (/<!ENTITY/i.test(body)) return { ok: false, error: "Feedet indeholder entitetsdefinitioner og er afvist." };
  const xml = body.replace(/<!DOCTYPE[^>[]*(\[[^\]]*\])?[^>]*>/gi, "");
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Feedet kunne ikke læses." };
  }

  const rss = doc.rss as { channel?: Record<string, unknown> } | undefined;
  const rdf = doc["rdf:RDF"] as Record<string, unknown> | undefined;
  const atom = doc.feed as Record<string, unknown> | undefined;

  if (rss?.channel || rdf) {
    const channel = (rss?.channel ?? rdf?.channel ?? {}) as Record<string, unknown>;
    const entries = arr((rss?.channel ? channel.item : rdf?.item) as Array<Record<string, unknown>>);
    const items = entries.slice(0, MAX_ITEMS).map((it): FeedItem => {
      const url = httpOnly(text(it.link) || text((it.guid as Record<string, unknown> | undefined)?.["#text"] ?? it.guid));
      const guid = text(it.guid).trim();
      return {
        id: guid || url || text(it.title),
        titel: clean(text(it.title)).slice(0, 300),
        url,
        tekst: clean(text(it["content:encoded"]) || text(it.description)),
        dato: date(it.pubDate ?? it["dc:date"]),
        kategorier: arr(it.category as unknown[]).map((c) => text(c).trim()).filter(Boolean).slice(0, 8),
      };
    });
    return { ok: true, titel: clean(text(channel.title)) || null, items: items.filter((i) => i.titel && i.id) };
  }

  if (atom) {
    const items = arr(atom.entry as Array<Record<string, unknown>>).slice(0, MAX_ITEMS).map((it): FeedItem => {
      const url = atomLink(it.link);
      return {
        id: text(it.id).trim() || url || text(it.title),
        titel: clean(text(it.title)).slice(0, 300),
        url,
        tekst: clean(text(it.summary) || text(it.content)),
        dato: date(it.published ?? it.updated),
        kategorier: arr(it.category as Array<Record<string, string>>).map((c) => String(c?.["@_term"] ?? "").trim()).filter(Boolean).slice(0, 8),
      };
    });
    return { ok: true, titel: clean(text(atom.title)) || null, items: items.filter((i) => i.titel && i.id) };
  }
  return { ok: false, error: "Det ligner hverken RSS, Atom eller JSON Feed." };
}

/** Nøgleordsfilter: mindst ét af `inkluder` (hvis angivet) og ingen af `ekskluder`. Uden hensyn til store/små bogstaver. */
export function matchesKeywords(item: Pick<FeedItem, "titel" | "tekst">, inkluder: readonly string[], ekskluder: readonly string[]): boolean {
  const hay = `${item.titel}\n${item.tekst}`.toLowerCase();
  if (ekskluder.some((w) => hay.includes(w.toLowerCase()))) return false;
  if (inkluder.length === 0) return true;
  return inkluder.some((w) => hay.includes(w.toLowerCase()));
}
