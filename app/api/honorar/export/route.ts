import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

function csv(value: string | number | Date | null) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.HONORAR_VIEW)) return Response.json({ error: "Ingen adgang." }, { status: 403 });
  const entries = await db.honorEntry.findMany({ where: { instansId: session.user.instansId }, include: { author: true, article: true, assignment: true }, orderBy: { generatedAt: "asc" } });
  const rows = [
    ["ID", "Status", "Modtager", "Opgave", "Artikel", "Leverancetype", "Beløb DKK", "Oprettet", "Godkendt"],
    ...entries.map((entry) => [entry.id, entry.status, entry.author.navn, entry.assignment.titel, entry.article.titel, entry.assignment.leverancetype, entry.beloeb, entry.generatedAt, entry.approvedAt]),
  ];
  const body = `\uFEFF${rows.map((row) => row.map(csv).join(";")).join("\r\n")}`;
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="honorar-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
