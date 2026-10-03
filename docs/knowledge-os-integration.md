# Knowledge OS: CMS-fundament og næste integrationstrin

Status: 3. oktober 2026. CMS-fundament med lokal publicerings-outbox; ingen live indholdslevering eller manuelt udførte produktionsmigrations. Den additive outbox-migration er committed og køres ved almindelig CMS-deploy.

**Livekontrol 3. oktober:** Railway-produktion kører stadig branchen `review-fixes` på `cd83b1`, mens outbox-committen `bc97425` ligger på `main`. En read-only katalogforespørgsel bekræftede, at outbox-tabellen endnu ikke findes i CMS-produktionsdatabasen. Pushet kode er derfor ikke det samme som deployet kode. `main` bygger oven på `review-fixes`; et eventuelt branch-skift kræver særskilt deploybeslutning. Knowledge OS har heller ikke kørt migration 012–014 på Railway. Se staging-readiness-rapporten i Knowledge OS-repositoryets `docs/staging-readiness-2026-10-03.md`.

Til den senere installation ligger et read-only hjælpescript i Knowledge OS: `npm run integration:install-check -- --cms-repo "../localcms" --json`. Det kontrollerer lokale repos og kan med eksplicitte read-only forbindelser kontrollere begge databaseskemaer uden at køre migrationer eller eksportere data. Den konkrete rækkefølge og en overdragelsesprompt findes i Knowledge OS-repositoryets `docs/final-integration-install.md`. Scriptets schemakontrol erstatter ikke verificeret backup/restore, deployed commit, tenant-isolation, tekstcapture eller en CMS-sender.

Opdatering senere 3. oktober: Knowledge OS har nu implementeret et default-off V1-API for generiske eksterne referencer, immutable versionsmetadata/hashes, historik, idempotency og CAS-current med en separat begrænset runtime. Kontrakten ligger i Knowledge OS-repositoryets `docs/integration-external-objects.md` og `docs/external-objects.openapi.json`. API’et er lokalt testet, ikke migreret/aktiveret på Railway. Det modtager endnu ikke artikeltekst eller embeddings. CMS-koden har nu en passiv outbox i begge publiceringsveje, men produktion kører fortsat den ældre branch og har ingen aktiv V1-sender. Researchadapteren er uændret.

## Formål og ejerskab

Knowledge OS skal være den vedvarende redaktionelle hukommelse: tekst, embeddings, entiteter, relationer, evidens og tidslig udvikling. CMS'et ejer artikler, publiceringsworkflow, redaktionelle rettigheder, publicerede artikelrevisioner og egne trafikmålinger. En Story i Knowledge OS er en længerevarende sag, som flere CMS-artikler kan knyttes til; den erstatter ikke Article.

CMS'et kommunikerer gennem backend-services, senere versionerede Knowledge OS-API'er og events. Det får ingen forbindelse til Knowledge OS' interne tabeller. Embeddings og grafberigelse udføres senere på Knowledge OS-siden. Denne leverance hverken beregner embeddings eller bygger en parallel graf i CMS'et.

Raw brugerhændelser bør blive i et analytics-lag. Stabile artikelreferencer og kontrollerede aggregater kan forbinde performance med grafens entiteter og emner. Redaktionel evidens, grafkvalitet og læserperformance er forskellige målinger: popularitet er ikke sandhed eller verifikation.

## Hvad der er implementeret

- `POST /api/redaktion/knowledge/research`: backend-gateway med frisk CMS-auth, aktiv instans, artikelrettigheder, same-origin-kontrol, lille JSON-body, strict input, rate limit og no-store.
- Editorens accordion **Tidligere viden** søger ved et eksplicit klik. Den viser kilde/reference, materialeorigin og ukendt verifikation. AI-afledte resultater markeres; hentet tekst gengives som escaped tekst og kan ikke udføre instruktioner eller HTML.
- Server-only adapter til den nuværende `GET /knowledge/context?topic=...`. Disabled er standard. Mock bruger tydeligt mærkede fixtures. Legacy-sandbox kræver eksplicit konfiguration af en isoleret installation og én CMS-instans.
- `prepareRevisionForMemory`: autoriseret læsning af en eksisterende ArticleRevision og en whitelistet tekstprojektion af en publiceret version.
- `prepareMetricsForMemory`: autoriseret læsning af eksisterende ArticleMetric og projektion af kumulative artikeltællere. Ingen visitor-identifikatorer eller rå events.
- `KnowledgePublicationOutbox`: én række pr. publiceret `ArticleRevision.id`, oprettet atomisk ved manuel publicering/opdatering eller planlagt publicering. Kun et revisions-FK og tidspunkt; ingen duplikeret artikeltekst eller ekstern levering.

De to prepare-services er lokale forberedelser og endnu ikke koblet til jobs eller HTTP-levering. Publiceringsflowet skriver kun en outbox-markør; ingen artikel er sendt til Knowledge OS. Research-panelets resultater er heller ikke automatisk knyttet til en artikel eller gemt som ny evidens.

## Afprøvning og konfiguration

Start det sædvanlige lokale CMS med testdata og `KNOWLEDGE_MODE=mock` for at afprøve panelet. Åbn en artikel eller en ny artikel, fold **Tidligere viden** ud og søg. Mock-resultater er demonstration, ikke redaktionens arkiv. `KNOWLEDGE_MODE=disabled` slår forbindelsen fra.

Sandbox kræver følgende servervariabler; se også `cms/.env.example`:

```dotenv
KNOWLEDGE_MODE=legacy-sandbox
KNOWLEDGE_SANDBOX_CONFIRMED=true
KNOWLEDGE_CMS_INSTANCE_ID=<eksisterende CMS Instance.id>
KNOWLEDGE_TENANT_ID=<eksisterende Knowledge OS tenant UUID>
KNOWLEDGE_INSTANCE_ID=<eksisterende Knowledge OS instance UUID>
KNOWLEDGE_OS_URL=https://<isoleret-sandbox-origin>
KNOWLEDGE_OS_API_KEY=<server-secret>
```

En erklæring i miljøet beviser ikke isolation. Operatøren skal sikre, at sandboxen kun rummer den tilladte instans' data. Adapteren accepterer kun en origin uden sti, query eller credentials; HTTPS eller HTTP-loopback, ingen redirects, timeout og validerede svar. API-nøglen bliver på serveren og returneres ikke til browseren. Produktions-Railway er ikke verificeret som isoleret sandbox og må ikke bruges som sådan.

## Identitet og kontrakter

CMS Instance, Article og ArticleRevision bruger CUID'er. Knowledge OS bruger UUID'er. De må ikke casts eller omskrives til hinanden. En eksplicit mapping forbinder den eksisterende CMS-instans med eksisterende Knowledge OS tenant/instance. CMS'et opretter ingen ny Tenant-model.

Artikelreferencens nøgle er `(system=bylokalt-cms, cmsInstanceId, type=Article, articleId)`. En version har den eksisterende `ArticleRevision.id` som `articleVersionId`; editorens optimistiske opdateringstimestamp er ikke en artikelversion. Senere ExternalObjectRef skal returnere et separat Knowledge OS-ID uden at ændre CMS-ID'erne.

`cms-research.v0`, `cms-memory-projection.v0` og `cms-article-metrics.v0` er foreløbige, interne adapter/projektionskontrakter. De er ikke en annoncering af allerede implementerede versionerede Knowledge OS-ingest-API'er. Aftal de eksterne kontrakter på Knowledge OS-siden før levering.

## Publiceret indhold, snapshots og provenance

Projektionen læser ArticleRevision.snapshot frem for den aktuelle Article-række, som siden kan være blevet redigeret. Instans, artikel, publiceret status og publiceringsdato valideres. Kun titel, manchet, sprog og tekst fra blokke samt stabile referencer og tidsstempler medtages. Forfatter-/bruger-ID'er, private provenance-felter, borgertips og upublicerede kladder eksporteres ikke.

`extractionVersion=cms-block-text-v1` beskriver tekstudtrækket. `textHash` er SHA-256 af udtrækkets UTF-8-tekst, ikke de oprindelige dokumentbytes. `projectionHash` inkluderer også metadata, mapping, version og tidspunkt. En identisk inputprojektion giver samme hash. Modtageren skal senere afvise ændret payload under samme uforanderlige versions-ID.

Dette er ikke et fuldstændigt layout-/mediearkiv: billeder, billedtekster og originale bytes kræver en særskilt capture-kontrakt. Ny AI-ekstraktion skal referere til den konkrete capture/version, chunk/evidens, model, prompt/extractor-version og confidence. AI-claims og entity-links er forslag indtil den aftalte redaktionelle validering. Der opfindes ikke kildehenvisninger ud fra en artikels titel.

## Analytics og grafkvalitet

ArticleMetric findes allerede. Projektionen deler `analyticsIdentity=(system, cmsInstanceId, articleId)` med indholdsprojektionen og indeholder:

| Felt | Betydning og begrænsning |
| --- | --- |
| views | CMS' kumulative visningstæller med eksisterende dedupe; ikke unikke personer |
| engagedReads | Den eksisterende tracking tæller `reached75`; ikke en ny engagement-definition |
| readerSeconds | Summerede registrerede læsesekunder; eksisterende tracking begrænser sekunder pr. event |
| asOf | Seneste ændring af metrikrækken; ikke begyndelsen af en måleperiode |
| articleVersionId | null: tracking har ingen dokumenteret revisionsattribution |

Ingen metrikrække returneres som `null`; den bliver ikke erstattet med et fiktivt nul. Grain er `cumulative-article`. Gentagne observationer skal erstatte eller afstemmes, aldrig summeres som nye events. Periodedifferencer kræver lagrede observationer, reset-håndtering og en aftalt tidsgrænse. Der findes ikke unikke brugere eller komplet tidsserie i denne kontrakt.

Når Knowledge OS har canonical artikelreferencer og versionsbestemte entity-links, kan et analytics-lag beregne performance pr. entitet/emne. En artikel kan have mange entiteter: totals på tværs af entiteter kræver dedupe eller eksplicit attribution, ellers dobbelttælles læsninger. Definér også, hvilken entity-link-version der bruges til historiske målinger.

Grafkvalitet bør senere måles særskilt: versions-/indholdsdækning, manglende embeddings, fejlede enrichment-jobs, dublerede entiteter, tvetydige merges og claims uden direkte evidens. Research bør vise, hvorfor et resultat er relevant, og om relationen er foreslået eller valideret. Disse graf- og analytics-endpoints er næste arbejde, ikke implementeret i panelet.

## Næste leverancer

1. **Knowledge OS autorisation og isolation:** verificér runtime-rolle, tenant/instance-grænser, backup/restore og migrationstilstand. Legacy-apiens globale adgangsnøgle kan ikke bruges som dokumentation for multi-tenant-sikkerhed.
2. **Færdiggør Knowledge OS-kontrakterne:** første autoriserede ExternalObjectRef/version/CAS-service med idempotency og hash-/metadatakonflikter er implementeret default-off. Før tekstlevering mangler fuld isolation af legacy indhold, per-owner dedup, immutable captures, materialebinding, evidens og retraction-regler. Genbrug eksisterende Source/Document/Chunk. Source er ophav; dokument/capture og afledte artifacts skal have hver deres sporbarhed. V1-reference-API’ets 2xx betyder ikke, at tekst er gemt eller indekseret.
3. **Holdbar CMS-outbox:** fundamentet dækker nu manuel publicering, opdatering af en publiceret artikel og planlagt publicering med unik revisions-FK i samme transaktion. Tilbagetrækning/hard delete, worker, eksplicit leveringstilstand, retry/backoff, karantæne og reparation mangler. Eksisterende operator-stream-events er ikke en holdbar leveringskø. Private indsendelser får først et særskilt adgangs- og dataminimeringsdesign.
4. **Backfill:** autoriseret, dry-run først, med eksisterende publicerede ArticleRevision-ID'er, cursor/checkpoint, konfliktkontrol og dedupe. En versionscapture må ikke rekonstrueres fra en senere redigeret artikel.
5. **Enrichment og research:** embeddings og foreslåede entiteter/claims/relations/events/story-links på Knowledge OS-siden. Research efter entitet og sag, tidslinje og kilde-evidens kræver nye autoriserede read-services ud over topic-context.
6. **Analytics-kobling:** kontrolleret eksport af aggregater og aftalte tidsserier til analytics-laget, join via stabile referencer og eksplicit entity-attribution. Definér graffunktionens egne kvalitetsmålinger før dashboardet bygges.

Den eksisterende `/ingest` skal ikke bruges som genvej til canonical CMS-versioner: den nuværende hashing/adgangskontrol dokumenterer ikke ovenstående identitets-, versions- og tenantgarantier. Et senere webhook skal verificere signatur, replay-vindue og event-ID; en trukket publicering skal påvirke relevante læseflader uden at slette historisk evidens.

## Kontrol og rollback

19 målrettede tests består, herunder manuel publicering, live-opdatering, planlagt publicering, samtidig scheduler-kørsel, afvist publicering, tenant-afgrænsning og projektion. PostgreSQL-skema/migration er i sync, Prisma-skemaet validerer, TypeScript/lint og produktionsbuild består. Ny PostgreSQL-migration er kun genereret offline; ingen native database- eller Railway-migration blev kørt i denne arbejdsrunde. SQLite-test-runnerren kunne ikke bygge en ny template med Prisma `db push`; samme schema-engine-fejl opstår med det uændrede forrige skema. De målrettede tests og den fulde suite blev kørt på en kopi af den tidligere fungerende isolerede template med den nye outbox-tabel/FK/unique-indeks tilføjet. Hele suiten: 722/726 består; de fire uændrede `seed-prod.test.ts`-tests fejler fortsat i deres egen Prisma `db push`-opsætning. Buildet afgiver to eksisterende Edge Runtime-advarsler uden relation til outboxen.

Rollback: sæt `KNOWLEDGE_MODE=disabled` og redeploy for at stoppe researchkald. Outboxen sender intet uanset denne variabel. Ved kode-rollback skal outbox-tabellen først beholdes, så allerede oprettede signaler kan genafspilles. En senere fjernelse af tabellen kræver optælling af rækker, verificeret backup og særskilt retentionbeslutning; den additive migration rører ikke eksisterende artikelrækker. Rækker slettes i dag via FK-cascade, hvis den tilhørende revision hard-deletes, så retraction/retention skal afklares før en worker aktiveres.
