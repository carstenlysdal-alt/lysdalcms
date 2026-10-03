export type FeedItemRow = {
  id: string;
  navn: string;
  type: string;
  url: string | null;
  sourceType: string | null;
  omraadeTekst: string | null;
  inkluder: string[];
  ekskluder: string[];
  intervalMin: number;
  aktiv: boolean;
  noter: string | null;
  kategori: string | null;
  prioritet: number;
  hentetLabel: string | null;
  sidsteStatus: string | null;
  sidsteAntal: number | null;
  sidsteBesked: string | null;
};

export type CityOption = { id: string; navn: string };
export type CatalogOption = { id: string; navn: string; antal: number };
