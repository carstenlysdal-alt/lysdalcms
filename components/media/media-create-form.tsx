"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { createMedia, type MediaFormState } from "@/app/(admin)/medier/actions";

export function MediaCreateForm() {
  const [state, action, pending] = useActionState<MediaFormState, FormData>(createMedia, {});
  const [source, setSource] = useState<"upload" | "external">("upload");
  const [type, setType] = useState("billede");
  return (
    <form action={action} className="media-form card elev-sm">
      <div className="seg" aria-label="Mediekilde">
        <label className="seg-opt"><input className="sr-only" type="radio" name="source" value="upload" checked={source === "upload"} onChange={() => setSource("upload")} />Upload fil</label>
        <label className="seg-opt"><input className="sr-only" type="radio" name="source" value="external" checked={source === "external"} onChange={() => setSource("external")} />Ekstern URL</label>
      </div>
      {state.error && <div className="dialog inline-dialog" role="alert"><strong className="dialog-title">Mediet kunne ikke oprettes</strong><p className="dialog-body">{state.error}</p></div>}
      {source === "upload" ? (
        <div className="field"><label htmlFor="file">Fil, maks. 10 MB</label><input className="input file-input" id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,application/pdf" required /></div>
      ) : <><div className="field"><label htmlFor="url">Direkte URL</label><input className="input" id="url" name="url" type="url" placeholder="https://…" required /></div><div className="field"><label htmlFor="filtype">Medietype</label><select className="input" id="filtype" name="filtype" value={type} onChange={(event) => setType(event.target.value)}>{["billede", "video", "lyd", "dokument"].map((item) => <option key={item}>{item}</option>)}</select></div></>}
      <MediaMetadataFields isImage={source === "upload" ? "unknown" : type === "billede"} />
      <button className="btn btn-primary" disabled={pending}><Upload size={17} /> {pending ? "Behandler…" : source === "upload" ? "Upload medie" : "Registrér medie"}</button>
    </form>
  );
}

export function MediaMetadataFields({ isImage, values }: { isImage: boolean | "unknown"; values?: { altTekst?: string | null; billedtekst?: string | null; ophavsperson?: string | null; rettighedsstatus?: string | null; licensType?: string | null; rettighedsUdlob?: string } }) {
  return <div className="media-metadata-grid">
    {isImage && <><div className="field"><label htmlFor="altTekst">Alt-tekst {isImage === true && "*"}</label><textarea className="input" id="altTekst" name="altTekst" defaultValue={values?.altTekst ?? ""} rows={3} required={isImage === true} /><p className="help-text">Obligatorisk for billeder. Beskriv det meningsbærende indhold for skærmlæsere.</p></div><div className="field"><label htmlFor="billedtekst">Billedtekst {isImage === true && "*"}</label><textarea className="input" id="billedtekst" name="billedtekst" defaultValue={values?.billedtekst ?? ""} rows={3} required={isImage === true} /></div></>}
    <div className="field"><label htmlFor="ophavsperson">Fotograf/ophavsperson</label><input className="input" id="ophavsperson" name="ophavsperson" defaultValue={values?.ophavsperson ?? ""} /></div>
    <div className="field"><label htmlFor="licensType">Licenstype</label><select className="input" id="licensType" name="licensType" defaultValue={values?.licensType ?? "Redaktionel brugsret"}><option>Redaktionel brugsret</option><option>Eget materiale</option><option>Creative Commons</option><option>Pressefoto</option><option>Ukendt</option></select></div>
    <div className="field"><label htmlFor="rettighedsstatus">Rettighedsstatus</label><select className="input" id="rettighedsstatus" name="rettighedsstatus" defaultValue={values?.rettighedsstatus ?? "Godkendt"}><option>Godkendt</option><option>Afventer dokumentation</option><option>Begrænset brug</option><option>Udløbet</option></select></div>
    <div className="field"><label htmlFor="rettighedsUdlob">Brugsret udløber</label><input className="input" id="rettighedsUdlob" name="rettighedsUdlob" type="date" defaultValue={values?.rettighedsUdlob ?? ""} /></div>
  </div>;
}
