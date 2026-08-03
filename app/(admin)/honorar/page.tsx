import { Download, WalletCards } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { approveHonor } from "./actions";

export default async function HonorPage() {
  const session = await auth();
  if (!session?.user) return null;
  const viewAll = can(session.user, PERMISSIONS.HONORAR_VIEW);
  const viewOwn = can(session.user, PERMISSIONS.HONOR_VIEW_OWN) && session.user.authorId;
  if (!viewAll && !viewOwn) return <main className="admin-main"><div className="dialog inline-dialog"><h1 className="dialog-title">Ingen adgang</h1><p className="dialog-body">Din rolle har ikke adgang til honorardata.</p></div></main>;
  const entries = await db.honorEntry.findMany({ where: { instansId: session.user.instansId, ...(!viewAll ? { authorId: session.user.authorId! } : {}) }, include: { author: true, article: true, assignment: true, approvedBy: true }, orderBy: { generatedAt: "desc" } });
  const pending = entries.filter((item) => item.status === "Afventer").reduce((sum, item) => sum + item.beloeb, 0);
  const approved = entries.filter((item) => item.status !== "Afventer").reduce((sum, item) => sum + item.beloeb, 0);
  const canManage = can(session.user, PERMISSIONS.HONOR_MANAGE);
  return <main className="admin-main"><div className="page-heading"><div><span className="eyebrow">CMS-06</span><h1>Honorarer</h1><p className="text-muted">{viewAll ? "Samlet fakturagrundlag" : "Dine honorarer"}</p></div>{viewAll && <a className="btn btn-secondary" href="/api/honorar/export"><Download size={17} /> Eksportér CSV</a>}</div>
    <div className="honor-summary"><article className="card"><WalletCards size={22} /><span>Afventer godkendelse</span><strong>{pending.toLocaleString("da-DK")} kr.</strong></article><article className="card"><WalletCards size={22} /><span>Godkendt/eksporteret</span><strong>{approved.toLocaleString("da-DK")} kr.</strong></article><article className="card"><WalletCards size={22} /><span>Antal posteringer</span><strong>{entries.length}</strong></article></div>
    <div className="table-wrap"><table className="table"><thead><tr><th>Opgave/artikel</th><th>Modtager</th><th>Oprettet</th><th>Status</th><th>Beløb</th><th></th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><strong>{entry.assignment.titel}</strong><small className="table-subtitle">{entry.article.titel}</small></td><td>{entry.author.navn}</td><td>{new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(entry.generatedAt)}</td><td><span className={`tag ${entry.status === "Godkendt" ? "tag-success" : "tag-warn"}`}>{entry.status}</span></td><td><strong>{entry.beloeb.toLocaleString("da-DK")} kr.</strong></td><td>{canManage && entry.status === "Afventer" && <form action={approveHonor.bind(null, entry.id)}><button className="btn btn-primary">Godkend</button></form>}</td></tr>)}</tbody></table>{!entries.length && <div className="empty-state">Ingen honorarposteringer endnu. De oprettes automatisk ved publicering af en koblet opgave.</div>}</div>
  </main>;
}
