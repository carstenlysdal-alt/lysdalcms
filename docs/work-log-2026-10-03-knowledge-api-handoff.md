# Knowledge OS API-handoff — 3. oktober 2026

CMS-leverancen 5293de1 er allerede committet/pushet. Brugeren bad om fortsættelse. Næste implementation er lavet i Knowledge OS-repositoryet, commit fc721bf: default-off, autoriseret V1-reference-/versions-API med RLS, separat begrænset runtime, immutable historik, operation receipts og CAS-current. Den er dokumenteret med OpenAPI 3.1 og 29 lokale tests.

CMS-integrationsplanen er opdateret med den nye modtagerstatus. CMS-runtime, publicering og researchadapter er ikke ændret i dette dokumentationscommit. Ingen ny CMS-sender, outbox, schemaændring eller produktionsoverførsel er aktiveret. Der er ikke provisioneret credentials eller anvendt Railway-migrations.

API-kontrakter i Knowledge OS: `docs/integration-external-objects.md`, `docs/external-objects.openapi.json`. Næste krav er fuld isolation af legacy knowledge indhold samt immutable tekstcaptures/evidens og derefter CMS-outbox. De eksisterende CMS-projektioner har fortsat status som lokal forberedelse, ikke en varig leveringskø.

User-owned files/CMS-DESIGN.md er ikke ændret eller medtaget.
