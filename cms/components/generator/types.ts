import type { ImageRef, ProfileId, SourceKind } from "@/lib/generate/types";

export type ClientSource = {
  key: string;
  kind: SourceKind;
  signalId?: string;
  titel: string;
  udgiver: string | null;
  url: string | null;
  dato: string | null;
  type: string | null;
  tekst: string;
  /** Billedreferencer fra siden. `brug` afgør, om referencen sendes med som grundlag for alt-tekst og billedtekst. */
  billeder: Array<ImageRef & { brug: boolean }>;
  noter: string[];
};

export type SignalOption = { id: string; titel: string; kilde: string; type: string | null; tidIso: string; harTekst: boolean; spaerret: boolean };
export type ProfileOption = { id: ProfileId; titel: string; beskrivelse: string; minKilder: number };
export type CategoryOption = { id: string; navn: string };

let counter = 0;
export const newKey = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;
