import Link from "next/link";
import { BriefcaseBusiness, Plus, Search } from "lucide-react";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { claimAssignment } from "./actions";

function deadlineClass(deadline: Date, status: string) {
  if (["Godkendt", "Annulleret"].includes(status)) return "";
  const hours = (deadline.getTime() - Date.now()) / 3_600_000;
  return hours < 0 ? "deadline-overdue" : hours <= 48 ? "deadline-soon" : "";
}

export default async function AssignmentsPage({ searchParams }: PageProps<"/opgaver">) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const viewAll = can(session.user, PERMISSIONS.TASK_VIEW_ALL);
  const where: Prisma.AssignmentWhereInput = {
    instansId: session.user.instansId,
    ...(status ? { status } : {}),
    AND: [
      ...(query ? [{ OR: [{ titel: { contains: query } }, { beskrivelse: { contains: query } }] }] : []),
      ...(!viewAll ? [{ OR: [{ assignedAuthorId: session.user.authorId ?? "__none__" }, { iPulje: true, status: "Åben" }] }] : []),
    ],
  };
  const assignments = await db.assignment.findMany({ where, include: { assignedAuthor: true, article: true }, orderBy: { afleveringsDeadline: "asc" } });
  const canManage = can(session.user, PERMISSIONS.TASK_MANAGE);
  return <main className="admin-main">
    <div className="page-heading"><div><span className="eyebrow">CMS-06</span><h1>Opgaver</h1><p className="text-muted">{assignments.length} aktive og historiske opgaver</p></div>{canManage && <Link className="btn btn-primary" href="/opgaver/ny"><Plus size={17} /> Ny opgave</Link>}</div>
    <form className="filter-bar assignment-filter"><label className="search-field"><Search size={17} /><input name="q" defaultValue={query} placeholder="Søg i opgaver" /></label><select className="input" name="status" defaultValue={status}><option value="">Alle statusser</option>{["Åben", "Tildelt", "I gang", "Afleveret", "Godkendt", "Annulleret"].map((item) => <option key={item}>{item}</option>)}</select><button className="btn btn-secondary">Filtrér</button></form>
    <div className="assignment-list">{assignments.length ? assignments.map((item) => <article className="assignment-row" key={item.id}><div className="assignment-icon"><BriefcaseBusiness size={20} /></div><div><span className="eyebrow">{item.leverancetype}</span><Link href={`/opgaver/${item.id}`}><strong>{item.titel}</strong></Link><small>{item.assignedAuthor?.navn ?? (item.iPulje ? "Opgavepulje" : "Ikke tildelt")} · {item.article?.titel ?? "Ingen artikel"}</small></div><span className={`assignment-deadline ${deadlineClass(item.afleveringsDeadline, item.status)}`}><small>Aflevering</small>{new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(item.afleveringsDeadline)}</span><span className="tag tag-neutral">{item.status}</span><strong className="assignment-fee">{item.estimeretHonorar.toLocaleString("da-DK")} kr.</strong>{item.iPulje && session.user.authorId && !canManage ? <form action={claimAssignment.bind(null, item.id)}><button className="btn btn-primary">Tag opgave</button></form> : <Link className="btn btn-secondary" href={`/opgaver/${item.id}`}>Åbn</Link>}</article>) : <div className="empty-state">Ingen opgaver matcher filtrene.</div>}</div>
  </main>;
}
