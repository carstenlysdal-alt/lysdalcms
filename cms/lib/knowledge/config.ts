import "server-only";
import { z } from "zod";

const mappingSchema = z.object({
  cmsInstanceId: z.string().trim().min(1).max(128),
  tenantId: z.string().uuid(),
  instanceId: z.string().uuid(),
});
export type KnowledgeMapping = z.infer<typeof mappingSchema>;
export type KnowledgeConfig =
  | { mode: "disabled" }
  | { mode: "mock" }
  | { mode: "legacy-sandbox"; mapping: KnowledgeMapping; baseUrl: string; apiKey: string; sandboxConfirmed: true };

/** No implicit conversion from CMS CUID to knowledge UUID; no production mode yet. */
export function readKnowledgeConfig(env: Record<string, string | undefined> = process.env): KnowledgeConfig {
  const mode = env.KNOWLEDGE_MODE || "disabled";
  if (mode === "disabled" || mode === "mock") return { mode };
  if (mode !== "legacy-sandbox" || env.KNOWLEDGE_SANDBOX_CONFIRMED !== "true") {
    throw new Error("Knowledge configuration is not an isolated sandbox");
  }
  const mapping = mappingSchema.parse({ cmsInstanceId: env.KNOWLEDGE_CMS_INSTANCE_ID,
    tenantId: env.KNOWLEDGE_TENANT_ID, instanceId: env.KNOWLEDGE_INSTANCE_ID });
  if (!env.KNOWLEDGE_OS_URL || !env.KNOWLEDGE_OS_API_KEY) throw new Error("Knowledge sandbox configuration is incomplete");
  return { mode, mapping, baseUrl: env.KNOWLEDGE_OS_URL, apiKey: env.KNOWLEDGE_OS_API_KEY, sandboxConfirmed: true };
}
