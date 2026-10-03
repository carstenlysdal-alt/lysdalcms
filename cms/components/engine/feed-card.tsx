"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FilePlus2, Link2, PenLine, TriangleAlert } from "lucide-react";
import { attachSourceAction, startFromSignalAction, startFromTipAction } from "@/app/redaktion/engine/actions";
import type { FeedCard } from "@/lib/engine/types";
import { useEngineBus } from "./engine-bus";
import { GradeBadge } from "./rating-badge";

const KIND_LABEL: Record<FeedCard["kind"], string> = { signal: "Signal", borgertip: "Borgertip", meddeler: "Meddeler", arkiv: "Arkiv" };

/** Ét kort i feedet. Handlingerne starter en kladde, lægger kortet på den åbne historie som kilde, eller åbner historien. */
export function FeedCardView({ card, canWrite }: { card: FeedCard; canWrite: boolean }) {
  const bus = useEngineBus();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const rawId = card.id.slice(card.id.indexOf(":") + 1);
  const openHref = card.articleId ? (card.kind === "arkiv" ? `/redaktion/artikler?id=${card.articleId}` : `/redaktion/engine?id=${card.articleId}`) : null;

  function begin() {
    setNote(null);
    startTransition(async () => {
      bus.showPane("edit");
      const res = card.kind === "signal" ? await startFromSignalAction(rawId) : await startFromTipAction(card.kind === "meddeler" ? "sag" : "tip", rawId);
      if (res && !res.ok) setNote({ ok: false, text: res.error });
    });
  }

  function attach() {
    setNote(null);
    startTransition(async () => {
      const res = await attachSourceAction(card.id);
      if (!res.ok) { setNote({ ok: false, text: res.error }); return; }
      const added = bus.addSource(res.kilde);
      setNote({ ok: added.ok, text: added.message });
    });
  }

  const canAttach = card.kind === "signal" || card.kind === "arkiv";
  return (
    <article className={`eng-item${card.hoej ? " is-high" : ""}${card.laest ? " is-read" : ""}`} aria-label={card.overskrift}>
      <header className="eng-item-head">
        <span className="eng-item-tags">
          {card.breaking && <span className="eng-tag is-danger">Hastenyhed</span>}
          {!card.breaking && card.hoej && <span className="eng-tag is-warn">Høj prioritet</span>}
          <span className="eng-tag">{KIND_LABEL[card.kind]}</span>
          {card.match !== undefined && <span className="eng-tag is-ai" title="Overlap i nøgleord mellem teksterne, ikke en AI-vurdering">Emneoverlap {card.match}%</span>}
        </span>
        <time className="eng-item-time" dateTime={card.tidIso}>{card.tidLabel}</time>
      </header>
      <h3 className="eng-item-title">{card.overskrift}</h3>
      {card.uddrag && <p className="eng-item-text">{card.uddrag}</p>}
      <p className="eng-item-meta">
        <GradeBadge grade={card.rating.grade} score={card.rating.score} title={`${card.rating.label}. ${card.rating.begrundelse}`} />
        <span className="eng-item-source">{card.kildeUrl ? <a href={card.kildeUrl} target="_blank" rel="noopener noreferrer">{card.kilde}<span className="cms-sr-only"> (åbner i ny fane)</span></a> : card.kilde}{card.omraade ? ` · ${card.omraade}` : ""}</span>
      </p>
      {card.rating.foelsom && <p className="eng-item-warn"><TriangleAlert size={12} aria-hidden="true" /> Kan indeholde personoplysninger</p>}
      {card.maskinindsamlet && !card.godkendt && <p className="eng-item-note">Maskinindsamlet, ikke redaktionelt vurderet</p>}
      <footer className="eng-item-actions">
        {openHref && <Link className="cms-btn cms-btn-secondary" href={openHref} scroll={false} onClick={() => bus.showPane("edit")} {...(card.kind === "arkiv" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{card.kind === "arkiv" ? "Åbn artikel" : "Åbn historien"}</Link>}
        {!openHref && canWrite && card.kind !== "arkiv" && (
          <button type="button" className="cms-btn cms-btn-primary" disabled={pending} onClick={begin}>
            {card.kind === "signal" ? <PenLine size={14} aria-hidden="true" /> : <FilePlus2 size={14} aria-hidden="true" />}
            {pending ? "Opretter…" : card.kind === "signal" ? "Skriv historien" : "Omsæt til kladde"}
          </button>
        )}
        {canAttach && bus.editorOpen && (
          <button type="button" className="cms-btn cms-btn-ai-soft" disabled={pending} onClick={attach}><Link2 size={14} aria-hidden="true" /> {card.kind === "arkiv" ? "Kobl som baggrund" : "Brug som kilde"}</button>
        )}
      </footer>
      <p className={`eng-item-feedback${note ? (note.ok ? " is-ok" : " is-bad") : ""}`} role="status" aria-live="polite">{note?.text}</p>
    </article>
  );
}
