import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import "@/styles/kontrolrum.css";
import { NoAccess } from "@/components/admin/no-access";
import { Page } from "@/components/ui/Page";
import { getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getPromptHistory, getPromptState } from "@/lib/prompts/store";
import { PromptEditor, type EditorDef } from "../PromptEditor";

const dateTime = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function PromptEditorPage({ params }: { params: Promise<{ noegle: string }> }) {
  const user = await getAuthorizedUser(PERMISSIONS.CONTROLROOM_MANAGE);
  if (!user) return <NoAccess area="prompts i kontrolrummet" />;
  const { noegle: raw } = await params;
  const noegle = decodeURIComponent(raw);
  const state = await getPromptState(user.instansId, noegle);
  if (!state) notFound();
  const history = await getPromptHistory(user.instansId, noegle);
  const { def, row, tilpasset, gaeldende } = state;

  const editorDef: EditorDef = {
    noegle: def.noegle,
    titel: def.titel,
    beskrivelse: def.beskrivelse,
    standard: def.standard,
    laast: def.laast,
    laastTitel: def.opgave || def.kind === "generator" ? "Svarformat (låst)" : "Sikkerhedsregler (låst)",
    minTegn: def.minTegn,
    maxTegn: def.maxTegn,
    eksempel: def.eksempel ?? null,
    opgave: def.opgave ?? null,
    profil: def.profil ?? null,
    kind: def.kind,
  };

  return (
    <Page width="wide">
      <p><Link className="btn btn-ghost" href="/redaktion/kontrolrum/prompts"><ChevronLeft size={16} aria-hidden="true" /> Alle prompts</Link></p>
      <PromptEditor
        key={`${def.noegle}-${row?.version ?? 0}`}
        def={editorDef}
        tilpasset={tilpasset}
        version={row?.version ?? 0}
        current={gaeldende}
        history={history.map((h) => ({ version: h.version, indhold: h.indhold, note: h.note, af: h.aendretAfNavn, tid: h.createdAt.toISOString(), tidLabel: dateTime.format(h.createdAt) }))}
      />
    </Page>
  );
}
