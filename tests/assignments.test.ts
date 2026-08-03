import assert from "node:assert/strict";
import test from "node:test";
import { assignmentSchema, canTransitionAssignment, honorAmountForAssignment, parseLocalDateTime } from "../lib/assignments";

test("opgavevalidering kræver brief, deadline og gyldigt honorar", () => {
  const valid = assignmentSchema.safeParse({ titel: "Dæk byrådsmødet", beskrivelse: "Research og skriv en balanceret artikel.", leverancetype: "Standardartikel", afleveringsDeadline: "2027-01-15T12:00", estimeretHonorar: "800", iPulje: false });
  assert.equal(valid.success, true);
  assert.equal(assignmentSchema.safeParse({ titel: "X", beskrivelse: "Kort", leverancetype: "Standardartikel", afleveringsDeadline: "", estimeretHonorar: -1 }).success, false);
});

test("journalisten kan starte og aflevere, men ikke godkende", () => {
  assert.equal(canTransitionAssignment("Tildelt", "I gang", "assigned"), true);
  assert.equal(canTransitionAssignment("I gang", "Afleveret", "assigned"), true);
  assert.equal(canTransitionAssignment("Afleveret", "Godkendt", "assigned"), false);
  assert.equal(canTransitionAssignment("Afleveret", "Godkendt", "manager"), true);
});

test("honorar afrundes deterministisk og kan ikke være negativt", () => {
  assert.equal(honorAmountForAssignment({ estimeretHonorar: 849.6 }), 850);
  assert.equal(honorAmountForAssignment({ estimeretHonorar: -100 }), 0);
});

test("lokal deadline parses og ugyldig dato afvises", () => {
  assert.ok(parseLocalDateTime("2027-01-15T12:00") instanceof Date);
  assert.equal(parseLocalDateTime("ikke-en-dato"), null);
});
