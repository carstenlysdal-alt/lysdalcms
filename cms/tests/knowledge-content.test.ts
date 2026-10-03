import assert from "node:assert/strict";
import test from "node:test";
import { projectPublishedRevision } from "../lib/knowledge/content-projection";
import { projectArticleMetrics } from "../lib/knowledge/metrics-projection";
import { readKnowledgeConfig } from "../lib/knowledge/config";

const mapping = { cmsInstanceId: "cms-cuid-city-a", tenantId: "60000000-0000-4000-8000-000000000001", instanceId: "60000000-0000-4000-8000-000000000002" };
const snapshot = { id: "article-cuid-a", instansId: mapping.cmsInstanceId, status: "Publiceret", titel: "Skolebudget", manchet: "Kommunen behandler budgettet", sprog: "da",
  blocks: [{ id: "p", type: "paragraph", data: { content: "<p>Skolen får et nyt budget.</p>" } }], publiceretTid: "2026-10-03T10:00:00Z",
  userId: "private-user", provenance: { confidential: "must-not-export" } };
const input = { articleId: snapshot.id, revisionId: "revision-cuid-a", snapshot, recordedAt: new Date("2026-10-03T10:01:00Z") };

test("memory projection preserves CMS IDs, publishes only snapshot text and is deterministic", () => {
  const a = projectPublishedRevision(input, mapping), b = projectPublishedRevision(input, mapping);
  assert.deepEqual(a, b); assert.equal(a.externalObject.articleVersionId, "revision-cuid-a");
  assert.equal(a.externalObject.articleId, snapshot.id); assert.equal(a.target.instanceId, mapping.instanceId);
  assert.equal(a.content.contentText, "Skolen får et nyt budget."); assert.equal(a.content.extractionVersion, "cms-block-text-v1");
  assert.match(a.content.textHash, /^[a-f0-9]{64}$/); assert.ok(!JSON.stringify(a).includes("must-not-export"));
  assert.ok(!JSON.stringify(a).includes("private-user"));
  const changed = projectPublishedRevision({ ...input, revisionId: "revision-cuid-b", snapshot: { ...snapshot, titel: "Rettet skolebudget" } }, mapping);
  assert.notEqual(changed.projectionHash, a.projectionHash);
  assert.deepEqual(changed.analyticsIdentity, a.analyticsIdentity); // metrics are article-level, not invented revision-level
});

test("memory projection rejects wrong city/article, draft snapshots and missing publication date", () => {
  assert.throws(() => projectPublishedRevision(input, { ...mapping, cmsInstanceId: "other-city" }));
  assert.throws(() => projectPublishedRevision({ ...input, articleId: "other-article" }, mapping));
  assert.throws(() => projectPublishedRevision({ ...input, snapshot: { ...snapshot, status: "Udkast" } }, mapping));
  assert.throws(() => projectPublishedRevision({ ...input, snapshot: { ...snapshot, publiceretTid: null } }, mapping));
  assert.throws(() => projectPublishedRevision({ ...input, snapshot: { ...snapshot, blocks: [] } }, mapping));
});

test("knowledge config defaults off; explicit mapping accepts CMS CUID but requires knowledge UUIDs", () => {
  assert.equal(readKnowledgeConfig({}).mode, "disabled"); assert.equal(readKnowledgeConfig({ KNOWLEDGE_MODE: "mock" }).mode, "mock");
  assert.throws(() => readKnowledgeConfig({ KNOWLEDGE_MODE: "production" }));
  assert.throws(() => readKnowledgeConfig({ KNOWLEDGE_MODE: "legacy-sandbox" }));
  const env = { KNOWLEDGE_MODE: "legacy-sandbox", KNOWLEDGE_SANDBOX_CONFIRMED: "true", KNOWLEDGE_CMS_INSTANCE_ID: mapping.cmsInstanceId,
    KNOWLEDGE_TENANT_ID: mapping.tenantId, KNOWLEDGE_INSTANCE_ID: mapping.instanceId, KNOWLEDGE_OS_URL: "https://sandbox.test", KNOWLEDGE_OS_API_KEY: "server-test-key" };
  assert.equal(readKnowledgeConfig(env).mode, "legacy-sandbox");
  assert.throws(() => readKnowledgeConfig({ ...env, KNOWLEDGE_INSTANCE_ID: mapping.cmsInstanceId }));
});

test("article metric projection preserves grain, never invents unique users or version attribution", () => {
  const metric = projectArticleMetrics({ cmsInstanceId: mapping.cmsInstanceId, articleId: snapshot.id,
    views: 100, reads: 20, readerSeconds: 900, asOf: input.recordedAt });
  assert.equal(metric.grain, "cumulative-article"); assert.equal(metric.articleVersionId, null);
  assert.equal(metric.semantics.uniqueUsersAvailable, false); assert.equal(metric.semantics.periodStartAvailable, false);
  assert.deepEqual(metric.analyticsIdentity, projectPublishedRevision(input, mapping).analyticsIdentity);
  assert.equal(metric.totals.engagedReads, 20);
  assert.throws(() => projectArticleMetrics({ cmsInstanceId: mapping.cmsInstanceId, articleId: snapshot.id,
    views: -1, reads: 0, readerSeconds: 0, asOf: input.recordedAt }));
});
