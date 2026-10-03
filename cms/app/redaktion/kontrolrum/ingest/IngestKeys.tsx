"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, KeyRound, Plus } from "lucide-react";
import { createIngestKeyAction, revokeIngestKeyAction } from "../../ingest/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field, Notice } from "@/components/ui/Layout";

export type KeyRow = { id: string; name: string; prefix: string; scopes: string[]; lastUsed: string | null; expires: string | null; revoked: boolean; created: string };

const SCOPES: Array<{ id: string; label: string; text: string }> = [
  { id: "signals:write", label: "Levere signaler", text: "Må sende signaler og hente feed-listen." },
  { id: "articles:draft", label: "Levere artikeludkast", text: "Må sende udkast. De kræver altid redaktionel gennemskrivning." },
  { id: "health:read", label: "Tjekke status", text: "Må kun læse driftsstatus." },
];

export function IngestKeys({ rows }: { rows: KeyRow[] }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["signals:write"]);
  const [days, setDays] = useState("90");
  const [created, setCreated] = useState<{ key: string; prefix: string } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function create(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setCreated(null);
    start(async () => {
      const res = await createIngestKeyAction(name, scopes, Number(days) || undefined);
      if (!res.success) { setMessage({ ok: false, text: res.error }); return; }
      setCreated({ key: res.key, prefix: res.prefix });
      setName("");
      setCopied(false);
      router.refresh();
    });
  }

  function revoke(id: string) {
    setMessage(null);
    start(async () => {
      const res = await revokeIngestKeyAction(id);
      setMessage(res.success ? { ok: true, text: "Nøglen er tilbagekaldt. Den virker ikke længere." } : { ok: false, text: res.error });
      if (res.success) router.refresh();
    });
  }

  async function copy() {
    if (!created) return;
    try { await navigator.clipboard.writeText(created.key); setCopied(true); } catch { setCopied(false); }
  }

  return (
    <div className="ui-stack ui-gap-lg">
      <Card title="API-nøgler" icon={<KeyRound size={16} />} description="Én nøgle pr. agent. Nøglen er bundet til denne by og kan ikke bruges til andre.">
        {message && <Notice tone={message.ok ? "success" : "danger"}>{message.text}</Notice>}
        {rows.length === 0 ? <p className="ui-section-text">Ingen nøgler endnu.</p> : (
          <ul className="kr-sources">
            {rows.map((k) => (
              <li key={k.id} className={`kr-source${k.revoked ? " is-off" : ""}`}>
                <div className="kr-source-head">
                  <div className="kr-source-main">
                    <strong>{k.name}</strong>
                    <span className="kr-muted"><code>{k.prefix}…</code> · {k.scopes.join(", ")}</span>
                    <span className="kr-source-note">Oprettet {k.created}{k.lastUsed ? ` · senest brugt ${k.lastUsed}` : " · aldrig brugt"}{k.expires ? ` · udløber ${k.expires}` : ""}</span>
                  </div>
                  <Badge tone={k.revoked ? "neutral" : "success"} dot>{k.revoked ? "Tilbagekaldt" : "Aktiv"}</Badge>
                  {!k.revoked && <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => { if (window.confirm(`Tilbagekald nøglen "${k.name}"? Agenten holder op med at virke.`)) revoke(k.id); }}>Tilbagekald</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Opret nøgle">
        {created && (
          <Notice tone="success" title="Nøglen er oprettet — kopiér den nu">
            <p>Den vises kun denne ene gang og kan ikke hentes igen.</p>
            <p className="kr-secret"><code>{created.key}</code></p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}><Copy size={14} aria-hidden="true" /> {copied ? "Kopieret" : "Kopiér nøgle"}</button>
          </Notice>
        )}
        <form onSubmit={create} className="ui-stack ui-gap-md">
          <Field label="Navn" htmlFor="key-navn" hint="Fx navnet på agenten. Mindst 3 tegn." required><input id="key-navn" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required aria-describedby="key-navn-hint" /></Field>
          <fieldset className="kr-fieldset">
            <legend>Rettigheder</legend>
            {SCOPES.map((s) => (
              <label key={s.id} className="check-row kr-scope">
                <input type="checkbox" checked={scopes.includes(s.id)} onChange={(e) => setScopes((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} />
                <span><strong>{s.label}</strong> <code>{s.id}</code><br /><small className="kr-muted">{s.text}</small></span>
              </label>
            ))}
          </fieldset>
          <Field label="Udløber efter (dage)" htmlFor="key-dage" hint="Tom eller 0 = udløber aldrig. Højst 730."><input id="key-dage" className="input" type="number" min={0} max={730} value={days} onChange={(e) => setDays(e.target.value)} aria-describedby="key-dage-hint" /></Field>
          <div className="ui-actions"><button type="submit" className="btn btn-primary" disabled={pending || name.trim().length < 3 || scopes.length === 0}><Plus size={16} aria-hidden="true" /> {pending ? "Opretter…" : "Opret nøgle"}</button></div>
        </form>
      </Card>
    </div>
  );
}
