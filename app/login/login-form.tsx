"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card elev-md login-card">
      <div className="card-kicker">Redaktionel adgang</div>
      <h1 className="card-title">Log ind i CMS</h1>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Adgangskode</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
      {state.error && <p className="error-text" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "Logger ind…" : "Log ind"}</button>
      <p className="help-text">Demooplysninger og lokal opsætning findes i README.</p>
    </form>
  );
}
