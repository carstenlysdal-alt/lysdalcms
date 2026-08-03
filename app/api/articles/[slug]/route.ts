import { db } from "@/lib/db";

export async function GET(_request: Request, context: RouteContext<"/api/articles/[slug]">) {
  const { slug } = await context.params;
  const article = await db.article.findFirst({
    where: { slug, status: "Publiceret" },
    select: {
      id: true, titel: true, manchet: true, slug: true, blocks: true,
      indholdstype: true, marking: true, pinned: true, breaking: true,
      seoTitel: true, seoBeskrivelse: true, sprog: true, publiceretTid: true, opdateretTid: true,
      kategori: { select: { navn: true, slug: true } },
      forfatter: { select: { navn: true, bio: true, profilbilledeUrl: true } },
      tags: { select: { navn: true } }, geoTags: { select: { navn: true } },
    },
  });
  if (!article) return Response.json({ error: "Artiklen findes ikke." }, { status: 404 });
  return Response.json({ data: article });
}
