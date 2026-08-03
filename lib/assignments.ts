import { z } from "zod";

export const DELIVERY_TYPES = [
  "Kort nyhedsartikel",
  "Standardartikel",
  "Dybdegående artikel/reportage",
  "Interview",
  "Fotoreportage",
  "Lydreportage/podcast",
  "Videoproduktion",
  "Live-dækning",
  "Opdatering af artikel",
  "Researchopgave",
] as const;

export const ASSIGNMENT_STATUSES = ["Åben", "Tildelt", "I gang", "Afleveret", "Godkendt", "Annulleret"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const assignmentSchema = z.object({
  titel: z.string().trim().min(3, "Titlen skal være mindst 3 tegn.").max(200),
  beskrivelse: z.string().trim().min(10, "Beskriv opgaven med mindst 10 tegn.").max(5000),
  leverancetype: z.enum(DELIVERY_TYPES),
  researchDeadline: z.string().trim().optional(),
  afleveringsDeadline: z.string().trim().min(1, "Afleveringsdeadline er obligatorisk."),
  estimeretHonorar: z.coerce.number().int().min(0).max(100000),
  assignedAuthorId: z.string().optional(),
  articleId: z.string().optional(),
  supportAgreementId: z.string().optional(),
  iPulje: z.coerce.boolean().default(false),
});

const assignedTransitions: Record<AssignmentStatus, AssignmentStatus[]> = {
  "Åben": [], "Tildelt": ["I gang"], "I gang": ["Afleveret"], "Afleveret": [], "Godkendt": [], "Annulleret": [],
};
const managerTransitions: Record<AssignmentStatus, AssignmentStatus[]> = {
  "Åben": ["Tildelt", "Annulleret"], "Tildelt": ["I gang", "Annulleret"], "I gang": ["Afleveret", "Annulleret"], "Afleveret": ["Godkendt", "I gang", "Annulleret"], "Godkendt": [], "Annulleret": ["Åben"],
};

export function canTransitionAssignment(from: string, to: string, role: "manager" | "assigned") {
  if (!ASSIGNMENT_STATUSES.includes(from as AssignmentStatus) || !ASSIGNMENT_STATUSES.includes(to as AssignmentStatus)) return false;
  const transitions = role === "manager" ? managerTransitions : assignedTransitions;
  return transitions[from as AssignmentStatus].includes(to as AssignmentStatus);
}

export function assignmentTransitions(from: string, role: "manager" | "assigned") {
  return ASSIGNMENT_STATUSES.filter((to) => canTransitionAssignment(from, to, role));
}

export function parseLocalDateTime(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function honorAmountForAssignment(assignment: { estimeretHonorar: number }) {
  return Math.max(0, Math.round(assignment.estimeretHonorar));
}
