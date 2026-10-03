import { getAuthorizedUser } from "@/lib/auth";
import { isSameOrigin, readJsonBody } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { researchForEditor } from "@/lib/knowledge/research";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ ok: false, code: "forbudt", error: "Ugyldig oprindelse." }, 403);
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return json({ ok: false, code: "ugyldig", error: "Forventer application/json." }, 415);
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return json({ ok: false, code: "forbudt", error: "Ikke autoriseret." }, 401);
  const raw = await readJsonBody(req, 2048);
  if (!raw.ok) return json({ ok: false, code: "ugyldig", error: raw.error }, raw.status);
  const result = await researchForEditor(user, raw.data);
  const status = result.ok ? 200 : { forbudt: 403, ugyldig: 400, rate: 429 }[result.code];
  return json(result, status);
}
