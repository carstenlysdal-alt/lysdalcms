/**
 * robots.txt (S15). RENT parser + en lille hentefunktion. Vi overholder `Disallow`/`Allow` for vores egen agent og for `*`.
 * 4xx (ingen robots.txt) = tilladt. 5xx = ikke tilladt (RFC 9309). Kan robots.txt slet ikke hentes, afgør selve hentningen.
 */
import { safeFetch, type SafeFetchDeps } from "./safe-fetch";

export type RobotsRule = { allow: boolean; path: string };

/** Regler for den mest specifikke gruppe, der matcher agenten, ellers `*`. */
export function parseRobots(text: string, agent = "lokalcms"): RobotsRule[] {
  const groups: Array<{ agents: string[]; rules: RobotsRule[] }> = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") current.rules.push({ allow: field === "allow", path: value });
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const pool = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes("*"));
  return pool.flatMap((g) => g.rules);
}

function matches(pattern: string, path: string): boolean {
  if (pattern === "") return false;
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Længste matchende regel vinder; ved lighed vinder Allow. Ingen match = tilladt. */
export function robotsAllows(rules: readonly RobotsRule[], path: string): boolean {
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (!matches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow && !best.allow)) best = rule;
  }
  return best ? best.allow : true;
}

export async function checkRobots(url: string, deps: SafeFetchDeps = {}): Promise<{ allowed: boolean }> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { allowed: false };
  }
  const res = await safeFetch(`${target.origin}/robots.txt`, { maxBytes: 128 * 1024, timeoutMs: 8_000, accept: "text/plain", contentTypes: [/^text\/plain$/, /^text\/html$/, /^application\/octet-stream$/] }, deps);
  if (res.ok) return { allowed: robotsAllows(parseRobots(res.body.toString("utf8")), `${target.pathname}${target.search}`) };
  if (res.code === "http_fejl") return { allowed: !(res.status && res.status >= 500) };
  return { allowed: true };
}
