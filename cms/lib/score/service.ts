import "server-only";
import { createHash } from "node:crypto";
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { estimateScore, type ScoreAnalysis, type ScoreCandidate } from "@/lib/ai/score";
import { createAiTextClient, NO_AI_MESSAGE } from "@/lib/ai/provider";
import { rateSource } from "@/lib/engine/source-rating";
import type { AiFailureReason, AiTextClient } from "@/lib/frontpage/ai-client";
import { can, PERMISSIONS } from "@/lib/permissions";
import { composeScorePrompt, SCORE_CONFIG_KEY, type PromptOverrides } from "@/lib/prompts/compose";
import { loadPromptOverrides } from "@/lib/prompts/store";
import { rateLimit } from "@/lib/ratelimit";
import { loadActiveSourceProfiles } from "@/lib/sources/store";
import { DEFAULT_SCORE_CONFIG, parseScoreConfigText, type ScoreConfig } from "./config";
import { computeScore, type ScoreEstimates, type ScoreResult } from "./model";

/**
 * Local Score for signaler: AI estimerer delscorer (gemmes), og totalen beregnes ud fra den GÆLDENDE konfiguration hver gang den vises.
 * Ændrer redaktionen vægtene, ændres alle vurderinger med det samme uden nyt AI-kald. Scoren er pre-publication og påvirker aldrig forsiden.
 */
export type ScoreView = { runId: string; result: ScoreResult; analyse: ScoreAnalysis; createdAt: string; promptVersion: string };
export type ScoreOutcome = { ok: true; view: ScoreView; genbrugt: boolean } | { ok: false; error: string };
export type ScoreDeps = { client?: AiTextClient | null; prompts?: PromptOverrides; skipRateLimit?: boolean; timeoutMs?: number; retries?: number; sleep?: (ms: number) => Promise<void> };

const FAILURE: Record<AiFailureReason, string> = {
  "ingen-noegle": NO_AI_MESSAGE,
  timeout: "AI svarede ikke i tide. Prøv igen om lidt.",
  "ugyldig-json": "AI gav et uforståeligt svar. Prøv igen.",
  schema: "AI's vurdering var ufuldstændig. Prøv igen.",
  "api-fejl": "AI-tjenesten er midlertidigt utilgængelig. Prøv igen om lidt.",
  "tomt-svar": "AI gav intet svar. Prøv igen.",
};

/** Konfigurationen for en instans: kontrolrummets version, hvis den er gyldig, ellers standarden. */
export function configFromOverrides(overrides: PromptOverrides): ScoreConfig {
  const text = overrides[SCORE_CONFIG_KEY];
  if (text === undefined) return DEFAULT_SCORE_CONFIG;
  const res = parseScoreConfigText(text);
  return res.ok ? res.config : DEFAULT_SCORE_CONFIG;
}

export async function loadScoreConfig(instansId: string): Promise<ScoreConfig> {
  return configFromOverrides(await loadPromptOverrides(instansId));
}

const asView = (row: { id: string; estimater: unknown; analyse: unknown; createdAt: Date; promptVersion: string }, config: ScoreConfig): ScoreView => ({
  runId: row.id,
  result: computeScore(row.estimater as ScoreEstimates, config),
  analyse: row.analyse as ScoreAnalysis,
  createdAt: row.createdAt.toISOString(),
  promptVersion: row.promptVersion,
});

/** Seneste vurdering pr. signal, beregnet med den gældende konfiguration. */
export async function loadScoreViews(instansId: string, signalIds: readonly string[], config?: ScoreConfig): Promise<Map<string, ScoreView>> {
  const out = new Map<string, ScoreView>();
  if (signalIds.length === 0) return out;
  const cfg = config ?? (await loadScoreConfig(instansId));
  const rows = await db.scoreRun.findMany({ where: { instansId, signalId: { in: [...signalIds] } }, orderBy: { createdAt: "desc" } });
  for (const row of rows) if (!out.has(row.signalId)) out.set(row.signalId, asView(row, cfg));
  return out;
}

export async function scoreSignal(user: AuthorizedUser, signalId: string, opts: { force?: boolean } = {}, deps: ScoreDeps = {}): Promise<ScoreOutcome> {
  if (!can(user, PERMISSIONS.ARTICLE_AI_USE)) return { ok: false, error: "Du har ikke adgang til AI i artikelarbejdet." };
  const instansId = user.instansId;
  const signal = await db.signal.findFirst({ where: { id: String(signalId), instansId } });
  if (!signal) return { ok: false, error: "Signalet findes ikke." };

  const prompts = deps.prompts ?? (await loadPromptOverrides(instansId));
  const config = configFromOverrides(prompts);
  const profiles = await loadActiveSourceProfiles(instansId);
  const rated = rateSource({ navn: signal.kilde, url: signal.kildeUrl, sourceType: signal.sourceType }, profiles);
  const tekst = (signal.brødtekst ?? "").trim();
  const candidate: ScoreCandidate = {
    titel: signal.overskrift,
    tekst,
    kilde: signal.kilde,
    kildetype: signal.sourceType,
    dato: (signal.kildeTidspunkt ?? signal.createdAt).toISOString().slice(0, 10),
    omraade: signal.omraadeTekst,
    kilderating: `${rated.grade} (${rated.score})`,
    kunOverskrift: tekst.length < 50,
  };
  const prompt = composeScorePrompt(prompts);
  const inputHash = createHash("sha256").update(JSON.stringify([candidate, prompt.version, prompt.instruction])).digest("hex");

  if (!opts.force) {
    const cached = await db.scoreRun.findFirst({ where: { instansId, signalId: signal.id, inputHash }, orderBy: { createdAt: "desc" } });
    if (cached) return { ok: true, view: asView(cached, config), genbrugt: true };
  }
  if (!deps.skipRateLimit) {
    const limited = await rateLimit({ bucket: "score-signal", key: user.id, limit: 60, windowMs: 10 * 60_000 });
    if (!limited.ok) return { ok: false, error: `For mange vurderinger på kort tid. Vent ${limited.retryAfterSec} sekunder.` };
  }

  const client = deps.client === undefined ? createAiTextClient({ task: "editor" }) : deps.client;
  const udbyder = client ? (client.providerId ?? "injiceret") : null;
  const result = await estimateScore(candidate, { client, prompts, timeoutMs: deps.timeoutMs, retries: deps.retries, sleep: deps.sleep });
  if (!result.ok) {
    await writeAudit(db, { instansId, actorId: user.id, actorLabel: user.name, action: "signal.score", targetId: signal.id, targetLabel: "Local Score", detail: { udfald: `fejl:${result.reason}`, udbyder } }).catch(() => undefined);
    return { ok: false, error: result.reason === "api-fejl" && result.userMessage ? result.userMessage : FAILURE[result.reason] };
  }
  const row = await db.scoreRun.create({
    data: {
      instansId, signalId: signal.id, userId: user.id, inputHash, promptVersion: prompt.custom.length ? `${prompt.version}+tilpasset` : prompt.version,
      estimater: result.value.estimater as never, analyse: result.value.analyse as never, udbyder, modelId: result.modelId ?? null,
      tokensInd: result.usage?.inputTokens ?? null, tokensUd: result.usage?.outputTokens ?? null,
    },
  });
  await writeAudit(db, { instansId, actorId: user.id, actorLabel: user.name, action: "signal.score", targetId: signal.id, targetLabel: "Local Score", detail: { udfald: "ok", udbyder, ...(result.usage ? { tokensInd: result.usage.inputTokens, tokensUd: result.usage.outputTokens } : {}) } }).catch(() => undefined);
  return { ok: true, view: asView(row, config), genbrugt: false };
}

/** Vurdér op til 10 signaler efter hinanden (springer dem over, der allerede har en gældende vurdering). */
export async function scoreSignals(user: AuthorizedUser, ids: readonly string[], deps: ScoreDeps = {}): Promise<{ ok: true; vurderet: number; genbrugt: number; fejl: string[] } | { ok: false; error: string }> {
  if (!can(user, PERMISSIONS.ARTICLE_AI_USE)) return { ok: false, error: "Du har ikke adgang til AI i artikelarbejdet." };
  let vurderet = 0;
  let genbrugt = 0;
  const fejl: string[] = [];
  for (const id of Array.from(new Set(ids)).slice(0, 10)) {
    const res = await scoreSignal(user, id, {}, deps);
    if (!res.ok) fejl.push(res.error);
    else if (res.genbrugt) genbrugt++;
    else vurderet++;
  }
  return { ok: true, vurderet, genbrugt, fejl: Array.from(new Set(fejl)) };
}
