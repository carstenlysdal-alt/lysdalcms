import type { Block, BlockType } from "./schema";

type RegistryItem = { label: string; create: (id: string) => Block };

export const blockRegistry: Record<BlockType, RegistryItem> = {
  paragraph: { label: "Brødtekst", create: (id) => ({ id, type: "paragraph", data: { content: "" } }) },
  heading: { label: "Overskrift", create: (id) => ({ id, type: "heading", data: { text: "", level: 2 } }) },
  subheading: { label: "Mellemrubrik", create: (id) => ({ id, type: "subheading", data: { text: "" } }) },
  manchet: { label: "Manchet", create: (id) => ({ id, type: "manchet", data: { text: "" } }) },
  quote: { label: "Citat", create: (id) => ({ id, type: "quote", data: { quote: "", attribution: "" } }) },
  factbox: { label: "Faktaboks", create: (id) => ({ id, type: "factbox", data: { title: "Fakta", content: "" } }) },
  image: { label: "Billede", create: (id) => ({ id, type: "image", data: { mediaId: "", url: "https://", alt: "", caption: "" } }) },
  infobox: { label: "Infoboks", create: (id) => ({ id, type: "infobox", data: { title: "", content: "" } }) },
};
