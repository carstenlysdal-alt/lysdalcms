import assert from "node:assert/strict";
import test from "node:test";
import { validateMarking } from "../lib/marking";
import { canTransition } from "../lib/workflow";

test("AC-01 blokerer sponsoreret indhold uden mærkning", () => {
  assert.equal(validateMarking("Sponsoreret", null).success, false);
  assert.equal(validateMarking("Partner", { sponsor: "", labelTekst: "Partnerindhold" }).success, false);
});

test("AC-01 accepterer komplet kommerciel mærkning", () => {
  assert.equal(validateMarking("Sponsoreret", { sponsor: "Eksempel A/S", labelTekst: "Sponsoreret indhold" }).success, true);
});

test("kun publiceringsretten åbner Godkendelse til Publiceret", () => {
  assert.equal(canTransition("Godkendelse", "Publiceret", { permissions: ["article.publish"] }), true);
  assert.equal(canTransition("Godkendelse", "Publiceret", { permissions: ["article.create"] }), false);
});
