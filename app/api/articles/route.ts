import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
  const articles = await db.article.findMany({
    where: { status: "Publiceret" },
    orderBy: { publiceretTid: "desc" },
    take: limit,
    select: {
      id: true, titel: true, manchet: true, slug: true, blocks: true,
      indholdstype: true, marking: true, pinned: true, breaking: true,
      seoTitel: true, seoBeskrivelse: true, sprog: true, publiceretTid: true, opdateretTid: true,
      kategori: { select: { navn: true, slug: true } },
      coverMedia: { select: { id: true, url: true, altTekst: true, billedtekst: true, ophavsperson: true } },
      forfatter: { select: { navn: true, bio: true, profilbilledeUrl: true } },
      tags: { select: { navn: true } }, geoTags: { select: { navn: true } },
    },
  });
  return Response.json({ data: articles, count: articles.length });
}
