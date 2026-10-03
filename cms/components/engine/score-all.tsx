"use client";

import { useState, useTransition } from "react";
import { Gauge } from "lucide-react";
import { scoreVisibleAction } from "@/app/redaktion/engine/actions";

/** Vurdér de synlige, endnu ikke vurderede signaler med Local Score (højst ti ad gangen). */
export function ScoreAll({ ids }: { ids: string[] }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  if (ids.length === 0 && !note) return null;
  return (
    <div className="eng-scoreall">
      {ids.length > 0 && (
        <button type="button" className="cms-btn cms-btn-ai-soft" disabled={pending} onClick={() => { setNote(null); start(async () => { const r = await scoreVisibleAction(ids); setNote(r.ok ? { ok: true, text: r.besked } : { ok: false, text: r.error }); }); }}>
          <Gauge size={14} aria-hidden="true" /> {pending ? "Vurderer…" : `Vurdér ${Math.min(ids.length, 10)} med Local Score`}
        </button>
      )}
      <p className={`eng-item-feedback${note ? (note.ok ? " is-ok" : " is-bad") : ""}`} role="status" aria-live="polite">{note?.text}</p>
    </div>
  );
}
