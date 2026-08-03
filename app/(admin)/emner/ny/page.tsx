import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function createTopic(data: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) return;
  const titel = data.get("titel") as string;
  const beskrivelse = data.get("beskrivelse") as string;
  const coverUrl = data.get("coverUrl") as string;
  const kategorierRaw = data.get("kategorier") as string;
  const kategorier = kategorierRaw.split(",").map((k) => k.trim()).filter(Boolean);
  await db.topic.create({
    data: { titel, beskrivelse: beskrivelse || null, coverUrl: coverUrl || null, kategorier, instansId: session.user.instansId },
  });
  redirect("/emner");
}

export default async function NytEmnePage() {
  const session = await auth();
  if (!session?.user) return null;
  return (
    <main className="admin-main">
      <div className="page-heading"><div><h1>Nyt emne</h1><p className="text-muted">Definer et emne du vil overvåge</p></div></div>
      <form action={createTopic} className="stack" style={{ maxWidth: 640 }}>
        <div className="field"><label htmlFor="titel">Emnetitel *</label><input className="input" id="titel" name="titel" required placeholder="fx Slagelse Kommune" /></div>
        <div className="field"><label htmlFor="beskrivelse">Beskrivelse</label><textarea className="input" id="beskrivelse" name="beskrivelse" rows={3} placeholder="Hvad skal overvåges?" /></div>
        <div className="field"><label htmlFor="kategorier">Kategorier (kommasepareret)</label><input className="input" id="kategorier" name="kategorier" placeholder="fx Politik, Økonomi, Lokalt" /></div>
        <div className="field"><label htmlFor="coverUrl">Cover-URL (valgfrit)</label><input className="input" id="coverUrl" name="coverUrl" type="url" placeholder="https://…" /></div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn-primary" type="submit">Opret emne</button>
          <a className="btn btn-secondary" href="/emner">Annullér</a>
        </div>
      </form>
    </main>
  );
}
