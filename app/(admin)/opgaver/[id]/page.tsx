import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { assignmentTransitions } from "@/lib/assignments";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { claimAssignment, transitionAssignment } from "../actions";

function localInput(date: Date | null) {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function AssignmentDetailPage({ params }: PageProps<"/opgaver/[id]">) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const assignment = await db.assignment.findFirst({ where: { id, instansId: session.user.instansId }, include: { assignedAuthor: true, article: true, supportAgreement: true, honorEntry: true } });
  if (!assignment) notFound();
  const manager = can(session.user, PERMISSIONS.TASK_MANAGE);
  const assigned = Boolean(session.user.authorId && assignment.assignedAuthorId === session.user.authorId);
  if (!manager && !assigned && !assignment.iPulje) return <main className="admin-main"><div className="dialog inline-dialog"><h1 className="dialog-title">Ingen adgang</h1><p className="dialog-body">Opgaven er tildelt en anden bidragyder.</p><Link className="btn btn-secondary" href="/opgaver">Til opgaver</Link></div></main>;
  const transitions = assignmentTransitions(assignment.status, manager ? "manager" : "assigned");
  const [authors, articles, agreements, rates] = manager ? await Promise.all([
    db.author.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" }, select: { id: true, navn: true } }),
    db.article.findMany({ where: { instansId: session.user.instansId, OR: [{ assignment: null }, { assignment: { id: assignment.id } }] }, orderBy: { createdAt: "desc" }, select: { id: true, titel: true } }),
    db.supportAgreement.findMany({ where: { instansId: session.user.instansId }, orderBy: { organisationNavn: "asc" }, select: { id: true, organisationNavn: true } }),
    db.honorRate.findMany({ where: { instansId: session.user.instansId, aktiv: true }, orderBy: { leverancetype: "asc" } }),
  ]) : [[], [], [], []];
  return <main className="admin-main"><Link className="btn btn-ghost" href="/opgaver"><ChevronLeft size={16} /> Opgaver</Link><div className="page-heading"><div><span className="eyebrow">{assignment.leverancetype}</span><h1>{assignment.titel}</h1><p className="text-muted">{assignment.assignedAuthor?.navn ?? (assignment.iPulje ? "Opgavepulje" : "Ikke tildelt")} · {assignment.estimeretHonorar.toLocaleString("da-DK")} kr.</p></div><span className="tag tag-neutral">{assignment.status}</span></div>
    <div className="assignment-detail-grid"><div>{manager ? <AssignmentForm value={{ id: assignment.id, titel: assignment.titel, beskrivelse: assignment.beskrivelse, leverancetype: assignment.leverancetype, researchDeadline: localInput(assignment.researchDeadline), afleveringsDeadline: localInput(assignment.afleveringsDeadline), estimeretHonorar: assignment.estimeretHonorar, assignedAuthorId: assignment.assignedAuthorId ?? "", articleId: assignment.articleId ?? "", supportAgreementId: assignment.supportAgreementId ?? "", iPulje: assignment.iPulje }} authors={authors} articles={articles} agreements={agreements} rates={rates} /> : <article className="card assignment-brief"><span className="card-kicker">Brief</span><p className="assignment-description">{assignment.beskrivelse}</p>{assignment.article && <Link href={`/artikler/${assignment.article.id}`}>Åbn artikel <ExternalLink size={13} /></Link>}</article>}</div>
      <aside className="assignment-sidebar"><section className="card"><span className="card-kicker">Deadlines</span><dl className="assignment-facts"><div><dt>Research</dt><dd>{assignment.researchDeadline ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(assignment.researchDeadline) : "Ikke sat"}</dd></div><div><dt>Aflevering</dt><dd>{new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(assignment.afleveringsDeadline)}</dd></div></dl></section>
        <section className="card"><span className="card-kicker">Interessekonflikt</span><p>{assignment.interessekonflikt || "Ikke erklæret endnu."}</p>{assignment.interessekonflikt && <span className={`tag ${assignment.konfliktGennemgaaet ? "tag-success" : "tag-warn"}`}>{assignment.konfliktGennemgaaet ? "Gennemgået" : "Afventer gennemgang"}</span>}</section>
        {assignment.honorEntry && <section className="card"><span className="card-kicker">Honorar</span><strong className="assignment-honor">{assignment.honorEntry.beloeb.toLocaleString("da-DK")} kr.</strong><span className="tag tag-neutral">{assignment.honorEntry.status}</span></section>}
        {assignment.iPulje && session.user.authorId && !manager && <form action={claimAssignment.bind(null, assignment.id)}><button className="btn btn-primary btn-block">Tag opgaven</button></form>}
        {transitions.length > 0 && <section className="card"><span className="card-kicker">Næste skridt</span>{transitions.map((target) => <form action={transitionAssignment.bind(null, assignment.id, target)} key={target}>{target === "Afleveret" && <div className="field"><label htmlFor={`conflict-${target}`}>Interessekonflikt</label><textarea className="input" id={`conflict-${target}`} name="interessekonflikt" required placeholder="Skriv 'Ingen' eller beskriv relationen" /></div>}<button className={target === "Godkendt" ? "btn btn-primary btn-block" : "btn btn-secondary btn-block"}>{target}</button></form>)}</section>}
      </aside></div>
  </main>;
}
