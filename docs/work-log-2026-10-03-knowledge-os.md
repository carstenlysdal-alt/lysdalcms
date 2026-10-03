# Arbejdslog: Knowledge OS-integration i CMS — 3. oktober 2026

Brugerens mål er en vedvarende indholdshukommelse med embeddings, knowledge graph, redaktionelle perspektiver og kobling til performance pr. entitet/emne. Arbejdet følger den aftalte første CMS-leverance og genbruger de eksisterende Instance, Article, ArticleRevision, ArticleMetric, auth og editor-komponenter.

## Leverance

- Server-only researchadapter fra Knowledge OS' CMS-starter (6a617ff), nu koblet til CMS-auth og aktiv instans gennem en backend-gateway.
- Research-accordion i artikel-editoren, med tydelige demo-/driftsstatusser, kildehenvisninger, AI-origin og ukendt verifikation. Ingen automatisk netværkstrafik før søgning og ingen integration med gem/publicér.
- Eksplicit CUID→UUID-mapping; ingen parallel Tenant/Article/grafmodel.
- Valideret, whitelistet projektion af eksisterende publiceret ArticleRevision.snapshot med revisions-ID, timestamps og hashes.
- Projektion af eksisterende kumulative ArticleMetric-tællere med samme artikelidentitet og eksplicit manglende bruger-, periode- og revisionsattribution. Ingen visitor-identifikatorer.
- Implementeret som lokale prepare-services, ikke koblet til publicering eller indholdslevering. Ingen schemaændringer eller migrations; ingen produktionsdata sendt eller ændret.

## Verifikation

- 17 målrettede tests består efter sidste kodeændring.
- Hele suiten: 722/726 består. De fire fejl er i den uændrede seed-prod-testfils before-hook, hvor Prisma fejler ved tom SQLite-testdatabase; reproduceret særskilt.
- Next.js-produktionsbuild består mod en isoleret SQLite-testkopi. TypeScript og ESLint for de berørte kodefiler består efter build.
- Chromium/Playwright: login med en midlertidig bruger i en isoleret testdatabase, åbning af editor, eksplicit mock-søgning, HTTP 200/no-store og tydeligt mærkede resultater består uden page errors. Desktop-screenshot gennemset. Mobil ved 390 px viser overlap fra editorens sidebar; shell-layout er ikke ændret i denne leverance.
- Secrets-scan af alle leverancens filer består. Git diff-check består.
- Det indbyggede browserplugins Node REPL var ikke tilgængeligt; browserkontrollen brugte projektets eksisterende Playwright/Chromium. Ingen produktionslogin, AI-kald eller Knowledge OS-netværkskald.

## Begrænsning og fortsættelse

Mode er disabled som standard. Mock giver fixtures; legacy-sandbox kræver en særskilt isoleret Knowledge OS-installation. Live multi-tenant-produktion kræver fortsat verificeret Knowledge OS-autorisation/isolation, stabile versionerede API-kontrakter, canonical references/captures og CMS-outbox. Embeddings og entity-enrichment beregnes ikke i denne leverance.

Se [integrationsplanen](knowledge-os-integration.md) for ejerskab, kontrakter, snapshots/provenance, analytics-grain, næste leverancer og rollback.
