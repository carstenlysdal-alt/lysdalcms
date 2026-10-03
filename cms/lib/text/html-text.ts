/** Ren tekst fra HTML (til uddrag og søgning). Ingen scripts eller styles; blokelementer bliver til linjeskift. RENT. */
import * as cheerio from "cheerio";

const BLOCK = "p,div,li,br,h1,h2,h3,h4,h5,h6,tr,blockquote,section,article,header,footer";

export function htmlToText(html: string, max = 20_000): string {
  const $ = cheerio.load(html);
  $("script,style,noscript,template,iframe,svg,form,nav,aside").remove();
  $(BLOCK).each((_, el) => {
    $(el).append("\n");
  });
  return $.root().text().replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}
