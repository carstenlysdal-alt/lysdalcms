"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateMedia, type MediaFormState } from "@/app/(admin)/medier/actions";
import { MediaMetadataFields } from "./media-create-form";

export function MediaEditForm({ media }: { media: { id: string; filtype: string; altTekst: string | null; billedtekst: string | null; ophavsperson: string | null; rettighedsstatus: string | null; licensType: string | null; rettighedsUdlob: Date | null } }) {
  const [state, action, pending] = useActionState<MediaFormState, FormData>(updateMedia.bind(null, media.id), {});
  return <form action={action} className="media-form card">
    {state.error && <div className="dialog inline-dialog" role="alert"><strong className="dialog-title">Kunne ikke gemme</strong><p className="dialog-body">{state.error}</p></div>}
    {state.success && <div className="notice-success" role="status">{state.success}</div>}
    <MediaMetadataFields isImage={media.filtype === "billede"} values={{ ...media, rettighedsUdlob: media.rettighedsUdlob?.toISOString().slice(0, 10) }} />
    <button className="btn btn-primary" disabled={pending}><Save size={16} /> {pending ? "Gemmer…" : "Gem metadata"}</button>
  </form>;
}
