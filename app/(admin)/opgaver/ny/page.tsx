import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function NewAssignmentPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!can(session.user, PERMISSIONS.TASK_MANAGE)) return <main className="admin-main"><div className="dialog inline-dialog"><h1 className="dialog-title">Ingen adgang</h1><p className="dialog-body">Kun redaktionel ledelse kan oprette opgaver.</p><Link className="btn btn-secondary" href="/opgaver">Til opgaver</Link></div></main>;
  const [authors, articles, agreements, rates] = await Promise.all([
    db.author.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" }, select: { id: true, navn: true } }),
    db.article.findMany({ where: { instansId: session.user.instansId, assignment: null }, orderBy: { createdAt: "desc" }, select: { id: true, titel: true } }),
    db.supportAgreement.findMany({ where: { instansId: session.user.instansId }, orderBy: { organisationNavn: "asc" }, select: { id: true, organisationNavn: true } }),
    db.honorRate.findMany({ where: { instansId: session.user.instansId, aktiv: true }, orderBy: { leverancetype: "asc" } }),
  ]);
  const initialType = "Standardartikel";
  const initialFee = rates.find((rate) => rate.leverancetype === initialType)?.standard ?? 800;
  return <main className="admin-main narrow-page"><Link className="btn btn-ghost" href="/opgaver"><ChevronLeft size={16} /> Opgaver</Link><div className="page-heading"><div><span className="eyebrow">CMS-06</span><h1>Ny opgave</h1></div></div><AssignmentForm value={{ id: null, titel: "", beskrivelse: "", leverancetype: initialType, researchDeadline: "", afleveringsDeadline: "", estimeretHonorar: initialFee, assignedAuthorId: "", articleId: "", supportAgreementId: "", iPulje: false }} authors={authors} articles={articles} agreements={agreements} rates={rates} /></main>;
}
