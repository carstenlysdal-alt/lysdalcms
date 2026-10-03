import "@/styles/grade.css";
import { GRADE_INFO, type SourceGrade } from "@/lib/engine/source-rating";

/** Karakter A-D. Bæres altid af bogstav og tekst, aldrig kun af farve. */
export function GradeBadge({ grade, score, compact = false, title }: { grade: SourceGrade; score?: number; compact?: boolean; title?: string }) {
  return (
    <span className={`eng-grade eng-grade-${grade}`} title={title ?? `${GRADE_INFO[grade].label}${score !== undefined ? ` (score ${score})` : ""}`}>
      <span className="eng-grade-letter" aria-hidden="true">{grade}</span>
      {!compact && <span className="eng-grade-label">{GRADE_INFO[grade].label}</span>}
      <span className="sr-only cms-sr-only">Kilderating {grade}: {GRADE_INFO[grade].label}{score !== undefined ? `, score ${score}` : ""}</span>
    </span>
  );
}
