"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { saveAssignment, type AssignmentFormState } from "@/app/(admin)/opgaver/actions";
import { DELIVERY_TYPES } from "@/lib/assignments";

type Option = { id: string; navn?: string; titel?: string; organisationNavn?: string };
type Rate = { leverancetype: string; standard: number; minimum: number; maksimum: number };
type Value = { id: string | null; titel: string; beskrivelse: string; leverancetype: string; researchDeadline: string; afleveringsDeadline: string; estimeretHonorar: number; assignedAuthorId: string; articleId: string; supportAgreementId: string; iPulje: boolean };

export function AssignmentForm({ value, authors, articles, agreements, rates }: { value: Value; authors: Option[]; articles: Option[]; agreements: Option[]; rates: Rate[] }) {
  const [state, action, pending] = useActionState<AssignmentFormState, FormData>(saveAssignment.bind(null, value.id), {});
  const [deliveryType, setDeliveryType] = useState(value.leverancetype);
  const [fee, setFee] = useState(value.estimeretHonorar);
  const [pool, setPool] = useState(value.iPulje);
  function selectDelivery(next: string) {
    setDeliveryType(next);
    const rate = rates.find((item) => item.leverancetype === next);
    if (rate) setFee(rate.standard);
  }
  const rate = rates.find((item) => item.leverancetype === deliveryType);
  return <form action={action} className="assignment-form card elev-sm">
    {state.error && <div className="dialog inline-dialog" role="alert"><strong className="dialog-title">Opgaven kunne ikke gemmes</strong><p className="dialog-body">{state.error}</p></div>}
    {state.success && <div className="notice-success">{state.success}</div>}
    <div className="field"><label htmlFor="titel">Opgavetitel</label><input className="input" id="titel" name="titel" defaultValue={value.titel} required />{state.fieldErrors?.titel?.map((error) => <p className="error-text" key={error}>{error}</p>)}</div>
    <div className="field"><label htmlFor="beskrivelse">Brief og forventet leverance</label><textarea className="input" id="beskrivelse" name="beskrivelse" rows={6} defaultValue={value.beskrivelse} required /></div>
    <div className="assignment-grid">
      <div className="field"><label htmlFor="leverancetype">Leverancetype</label><select className="input" id="leverancetype" name="leverancetype" value={deliveryType} onChange={(event) => selectDelivery(event.target.value)}>{DELIVERY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label htmlFor="estimeretHonorar">Estimeret honorar, kr.</label><input className="input" id="estimeretHonorar" name="estimeretHonorar" type="number" min="0" step="50" value={fee} onChange={(event) => setFee(Number(event.target.value))} />{rate && <p className="help-text">Vejledende interval: {rate.minimum.toLocaleString("da-DK")}–{rate.maksimum.toLocaleString("da-DK")} kr.</p>}</div>
      <div className="field"><label htmlFor="researchDeadline">Researchdeadline</label><input className="input" id="researchDeadline" name="researchDeadline" type="datetime-local" defaultValue={value.researchDeadline} /></div>
      <div className="field"><label htmlFor="afleveringsDeadline">Afleveringsdeadline</label><input className="input" id="afleveringsDeadline" name="afleveringsDeadline" type="datetime-local" defaultValue={value.afleveringsDeadline} required /></div>
    </div>
    <label className="check-row assignment-pool"><input type="checkbox" name="iPulje" checked={pool} onChange={(event) => setPool(event.target.checked)} /> Slå op i opgavepuljen</label>
    <div className="assignment-grid">
      <div className="field"><label htmlFor="assignedAuthorId">Tildelt journalist</label><select className="input" id="assignedAuthorId" name="assignedAuthorId" defaultValue={value.assignedAuthorId} disabled={pool}><option value="">Ikke tildelt</option>{authors.map((item) => <option key={item.id} value={item.id}>{item.navn}</option>)}</select></div>
      <div className="field"><label htmlFor="articleId">Koblet artikel</label><select className="input" id="articleId" name="articleId" defaultValue={value.articleId}><option value="">Ingen artikel endnu</option>{articles.map((item) => <option key={item.id} value={item.id}>{item.titel}</option>)}</select></div>
      <div className="field"><label htmlFor="supportAgreementId">Støtteaftale</label><select className="input" id="supportAgreementId" name="supportAgreementId" defaultValue={value.supportAgreementId}><option value="">Ingen støtteaftale</option>{agreements.map((item) => <option key={item.id} value={item.id}>{item.organisationNavn}</option>)}</select></div>
    </div>
    <button className="btn btn-primary" disabled={pending}><Save size={16} /> {pending ? "Gemmer…" : "Gem opgave"}</button>
  </form>;
}
