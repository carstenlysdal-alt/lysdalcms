"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SourceDraft } from "@/lib/engine/types";

export type Pane = "feed" | "edit" | "copilot";
export type AddSourceResult = { ok: boolean; message: string };
type Adder = (source: SourceDraft) => AddSourceResult;

type Bus = {
  /** Er der en artikel åben i editoren? (feedkort viser først da "Brug som kilde") */
  editorOpen: boolean;
  addSource: (source: SourceDraft) => AddSourceResult;
  pane: Pane;
  showPane: (pane: Pane) => void;
  registerAdder: (fn: Adder | null) => void;
};

const Ctx = createContext<Bus | null>(null);

/**
 * Forbinder de tre felter i Production Engine uden at løfte editorens tilstand op: feedkortene (venstre) lægger en kilde
 * på artiklen, og editoren (som ejer tilstanden) registrerer, hvordan det gøres. Panelvalget (mobil/tablet) bor her også.
 */
export function EngineBusProvider({ initialPane, children }: { initialPane: Pane; children: React.ReactNode }) {
  const adder = useRef<Adder | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pane, setPane] = useState<Pane>(initialPane);

  const registerAdder = useCallback((fn: Adder | null) => {
    adder.current = fn;
    setEditorOpen(fn !== null);
  }, []);
  const addSource = useCallback((source: SourceDraft): AddSourceResult => (adder.current ? adder.current(source) : { ok: false, message: "Åbn først en historie i editoren." }), []);

  const value = useMemo<Bus>(() => ({ editorOpen, addSource, pane, showPane: setPane, registerAdder }), [editorOpen, addSource, pane, registerAdder]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEngineBus(): Bus {
  const bus = useContext(Ctx);
  if (!bus) throw new Error("useEngineBus kræver EngineBusProvider");
  return bus;
}

/** Editoren registrerer, hvordan en kilde lægges på den åbne artikel. Fravælges ved afmontering. */
export function useRegisterSourceAdder(fn: Adder | null) {
  const bus = useContext(Ctx);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const register = bus?.registerAdder;
  const active = fn !== null;
  useEffect(() => {
    if (!register || !active) return;
    register((s) => (fnRef.current ? fnRef.current(s) : { ok: false, message: "Editoren er ikke klar." }));
    return () => register(null);
  }, [register, active]);
}
