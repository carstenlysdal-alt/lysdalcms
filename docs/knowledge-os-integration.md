# Knowledge OS: CMS-fundament og næste integrationstrin

Status: 3. oktober 2026. Første CMS-leverance; ingen live indholdslevering, schemaændringer eller produktionsmigrations.

Opdatering senere 3. oktober: Knowledge OS har nu implementeret et default-off V1-API for generiske eksterne referencer, immutable versionsmetadata/hashes, historik, idempotency og CAS-current med en separat begrænset runtime. Kontrakten ligger i Knowledge OS-repositoryets `docs/integration-external-objects.md` og `docs/external-objects.openapi.json`. API’et er lokalt testet, ikke migreret/aktiveret på Railway. Det modtager endnu ikke artikeltekst eller embeddings. CMS-runtime er uændret og benytter fortsat kun den eksisterende researchadapter; der er ingen aktiv V1-sender.

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

De to prepare-services er lokale forberedelser og endnu ikke koblet til publicering, jobs eller HTTP-levering. Ingen artikel er sendt til Knowledge OS. Research-panelets resultater er heller ikke automatisk knyttet til en artikel eller gemt som ny evidens.

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
3. **Holdbar CMS-outbox:** skriv leveringsintention i samme transaktion som publiceringsrevisionen. Dæk manuel publicering, planlagt publicering, senere opdateringer og tilbagetrækning. Worker håndterer retry/backoff, dedupe, status og reparation. Eksisterende operator-stream-events er ikke en holdbar leveringskø. Private indsendelser får først et særskilt adgangs- og dataminimeringsdesign.
4. **Backfill:** autoriseret, dry-run først, med eksisterende publicerede ArticleRevision-ID'er, cursor/checkpoint, konfliktkontrol og dedupe. En versionscapture må ikke rekonstrueres fra en senere redigeret artikel.
5. **Enrichment og research:** embeddings og foreslåede entiteter/claims/relations/events/story-links på Knowledge OS-siden. Research efter entitet og sag, tidslinje og kilde-evidens kræver nye autoriserede read-services ud over topic-context.
6. **Analytics-kobling:** kontrolleret eksport af aggregater og aftalte tidsserier til analytics-laget, join via stabile referencer og eksplicit entity-attribution. Definér graffunktionens egne kvalitetsmålinger før dashboardet bygges.

Den eksisterende `/ingest` skal ikke bruges som genvej til canonical CMS-versioner: den nuværende hashing/adgangskontrol dokumenterer ikke ovenstående identitets-, versions- og tenantgarantier. Et senere webhook skal verificere signatur, replay-vindue og event-ID; en trukket publicering skal påvirke relevante læseflader uden at slette historisk evidens.

## Kontrol og rollback

17 målrettede tests består: rettigheder og aktiv instans, forfatterbegrænsning, auth/origin/body-validering, no-store, disabled/mock/fejlet/empty research, escaped ubetroet tekst, publicerede snapshots, mapping og metrik-grain. Produktionsbuild, TypeScript og lint af de berørte kodefiler består.

Hele testsuiten: 722/726 består. Fire eksisterende tests i `seed-prod.test.ts` fejler i samme before-hook med Prisma Schema engine error under opsætning af tom SQLite-testdatabase; også reproduceret ved særskilt kørsel af den uændrede testfil. Ingen rettelse af seed eller produktionsschema er med i leverancen. Browserkontrollens resultat er registreret i arbejdsloggen.

Rollback: sæt `KNOWLEDGE_MODE=disabled` og redeploy. Det bevarer editorens gemme-/publiceringsflow og stopper eksterne researchkald. Fjern om ønsket CMS-committen ved normal revert. Ingen schema-rollback eller datamigration er nødvendig, fordi denne leverance ikke ændrer schema eller leverer indhold.
