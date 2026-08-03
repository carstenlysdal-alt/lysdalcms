"use client";

import { useActionState, useState } from "react";
import { Save, Send } from "lucide-react";
import { saveArticle, type ArticleFormState } from "@/app/(admin)/artikler/actions";
import { BlockEditor } from "./block-editor";
import type { Block } from "@/lib/blocks/schema";

type Option = { id: string; navn: string };
type ArticleValue = {
  id: string | null; titel: string; manchet: string; slug: string; blocks: Block[]; status: string;
  indholdstype: string; aiBrug: string[]; marking: { sponsor?: string; labelTekst?: string } | null;
  pinned: boolean; breaking: boolean; seoTitel: string; seoBeskrivelse: string; sprog: string;
  kategoriId: string; forfatterId: string; coverMediaId: string; tagIds: string[]; geoTagIds: string[];
};

type MediaOption = { id: string; url: string; altTekst: string | null; billedtekst: string | null; filnavn: string | null };

export function ArticleForm({ article, categories, authors, tags, geoTags, media, transitions, canPublish }: {
  article: ArticleValue; categories: Option[]; authors: Option[]; tags: Option[]; geoTags: Option[]; media: MediaOption[]; transitions: string[]; canPublish: boolean;
}) {
  const action = saveArticle.bind(null, article.id);
  const [state, formAction, pending] = useActionState<ArticleFormState, FormData>(action, {});
  const [contentType, setContentType] = useState(article.indholdstype);
  const isCommercial = contentType === "Partner" || contentType === "Sponsoreret";
  return (
    <form action={formAction} className="editor-form">
      <div className="editor-main">
        {state.error && <div className="dialog inline-dialog" role="alert"><div className="dialog-title">Artiklen kunne ikke gemmes</div><div className="dialog-body">{state.error}</div></div>}
        {state.success && <div className="notice-success" role="status">{state.success}</div>}
        <div className="field"><label htmlFor="titel">Titel</label><input className="input title-input" id="titel" name="titel" defaultValue={article.titel} required />{state.fieldErrors?.titel?.map((error) => <p className="error-text" key={error}>{error}</p>)}</div>
        <div className="field"><label htmlFor="manchet">Manchet</label><textarea className="input" id="manchet" name="manchet" defaultValue={article.manchet} rows={3} /></div>
        <div className="editor-label">Indhold</div>
        <BlockEditor initialBlocks={article.blocks} media={media} />
      </div>
      <aside className="editor-sidebar">
        <div className="sidebar-actions"><button className="btn btn-secondary" disabled={pending}><Save size={16} /> {pending ? "Gemmer…" : "Gem"}</button>
          {transitions.map((status) => <button key={status} className={status === "Publiceret" ? "btn btn-primary" : "btn btn-secondary"} name="targetStatus" value={status} disabled={pending || (status === "Publiceret" && !canPublish)}>{status === "Publiceret" && <Send size={16} />} {status}</button>)}
        </div>
        <div className="sidebar-status"><span>Status</span><strong><span className="dot-status dot-draft" /> {article.status}</strong></div>
        <section className="sidebar-section"><h2>Organisering</h2>
          <div className="field"><label htmlFor="kategoriId">Kategori</label><select className="input" id="kategoriId" name="kategoriId" defaultValue={article.kategoriId}><option value="">Vælg kategori</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.navn}</option>)}</select></div>
          <div className="field"><label htmlFor="forfatterId">Forfatter</label><select className="input" id="forfatterId" name="forfatterId" defaultValue={article.forfatterId}><option value="">Vælg forfatter</option>{authors.map((item) => <option key={item.id} value={item.id}>{item.navn}</option>)}</select></div>
          <div className="field"><label htmlFor="coverMediaId">Coverbillede</label><select className="input" id="coverMediaId" name="coverMediaId" defaultValue={article.coverMediaId}><option value="">Intet coverbillede</option>{media.map((item) => <option key={item.id} value={item.id}>{item.billedtekst || item.filnavn || item.id}</option>)}</select></div>
          <fieldset className="field checkbox-grid"><legend>Tags</legend>{tags.map((item) => <label key={item.id}><input type="checkbox" name="tagIds" value={item.id} defaultChecked={article.tagIds.includes(item.id)} /> {item.navn}</label>)}</fieldset>
          <fieldset className="field checkbox-grid"><legend>Geografi</legend>{geoTags.map((item) => <label key={item.id}><input type="checkbox" name="geoTagIds" value={item.id} defaultChecked={article.geoTagIds.includes(item.id)} /> {item.navn}</label>)}</fieldset>
        </section>
        <section className="sidebar-section"><h2>Indholdstype og mærkning</h2>
          <div className="field"><label htmlFor="indholdstype">Indholdstype</label><select className="input" id="indholdstype" name="indholdstype" value={contentType} onChange={(event) => setContentType(event.target.value)}>{["Uafhængig", "Partner", "Sponsoreret", "Brugerindsendt", "PR"].map((item) => <option key={item}>{item}</option>)}</select></div>
          {isCommercial && <div className="commercial-fields"><p className="help-text">Obligatorisk før publicering.</p><div className="field"><label htmlFor="markingSponsor">Sponsor/partner</label><input className="input" id="markingSponsor" name="markingSponsor" defaultValue={article.marking?.sponsor} /></div><div className="field"><label htmlFor="markingLabel">Synlig mærkning</label><input className="input" id="markingLabel" name="markingLabel" defaultValue={article.marking?.labelTekst} placeholder={contentType === "Partner" ? "Partnerindhold" : "Sponsoreret indhold"} /></div></div>}
        </section>
        <section className="sidebar-section"><h2>AI-brug</h2><fieldset className="checkbox-grid">{["Ingen", "Sproglig korrektur", "Omskrivning", "Transskribering", "Udkast"].map((item) => <label key={item}><input type="checkbox" name="aiBrug" value={item} defaultChecked={article.aiBrug.includes(item)} /> {item}</label>)}</fieldset></section>
        <section className="sidebar-section"><h2>SEO og publicering</h2>
          <div className="field"><label htmlFor="slug">Slug</label><input className="input" id="slug" name="slug" defaultValue={article.slug} required /></div>
          <div className="field"><label htmlFor="seoTitel">SEO-titel</label><input className="input" id="seoTitel" name="seoTitel" defaultValue={article.seoTitel} /></div>
          <div className="field"><label htmlFor="seoBeskrivelse">Metabeskrivelse</label><textarea className="input" id="seoBeskrivelse" name="seoBeskrivelse" defaultValue={article.seoBeskrivelse} /></div>
          <div className="field"><label htmlFor="sprog">Sprog</label><input className="input" id="sprog" name="sprog" defaultValue={article.sprog} /></div>
          <label className="check-row"><input type="checkbox" name="breaking" defaultChecked={article.breaking} /> Breaking</label>
          <label className="check-row"><input type="checkbox" name="pinned" defaultChecked={article.pinned} /> Fastgjort på forsiden</label>
        </section>
      </aside>
    </form>
  );
}
