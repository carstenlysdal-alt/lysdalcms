import "server-only";
import type { AuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { rateLimit } from "@/lib/ratelimit";
import { createCmsKnowledgeAdapter } from "./legacy-adapter";
import { readKnowledgeConfig, type KnowledgeConfig } from "./config";
import { researchRequestSchema, type ResearchResponse, type ResearchResult } from "./contracts";

const MOCK_SCOPE = { tenantId: "40000000-0000-4000-8000-000000000001", instanceId: "40000000-0000-4000-8000-000000000002" };
const fail = (code: "forbudt" | "ugyldig" | "rate", error: string): ResearchResponse => ({ ok: false, code, error });
const empty = (status: ResearchResult["status"], topic: string): ResearchResponse => ({ ok: true,
  result: { contractVersion: "cms-research.v0", status, topic, evidence: [], contradictions: [] } });

/** Trusted user comes from getAuthorizedUser; request never chooses the CMS/knowledge instance. */
export async function researchForEditor(user: AuthorizedUser, input: unknown,
  deps: { config?: KnowledgeConfig; fetcher?: typeof fetch } = {}): Promise<ResearchResponse> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return fail("forbudt", "Du har ikke adgang til research i artikelarbejdet.");
  const parsed = researchRequestSchema.safeParse(input);
  if (!parsed.success) return fail("ugyldig", "Angiv et emne på 2–300 tegn uden ekstra felter.");
  const { query, articleId } = parsed.data;
  if (articleId) {
    const article = await db.article.findFirst({ where: { id: articleId, instansId: user.instansId }, select: { forfatterId: true } });
    if (!article || !canEditArticle(user, article)) return fail("forbudt", "Artiklen er ikke tilgængelig for dig.");
  }
  const limit = await rateLimit({ bucket: "knowledge-research", key: `knowledge:research:${user.instansId}:${user.id}`, limit: 20, windowMs: 60_000, failMode: "closed" });
  if (!limit.ok) return fail("rate", "For mange researchforespørgsler. Prøv igen om lidt.");
  try {
    const config = deps.config ?? readKnowledgeConfig();
    if (config.mode === "disabled") return empty("disabled", query);
    if (config.mode === "mock") {
      const adapter = createCmsKnowledgeAdapter(config, deps.fetcher);
      return { ok: true, result: await adapter.research(MOCK_SCOPE, query) };
    }
    // This is only a local guard on an explicitly isolated sandbox, not remote tenant isolation.
    if (config.mapping.cmsInstanceId !== user.instansId) return empty("disabled", query);
    const adapter = createCmsKnowledgeAdapter({ mode: config.mode, baseUrl: config.baseUrl, apiKey: config.apiKey,
      sandboxConfirmed: config.sandboxConfirmed, allowedScope: config.mapping }, deps.fetcher);
    return { ok: true, result: await adapter.research(config.mapping, query) };
  } catch { return empty("unavailable", query); }
}
