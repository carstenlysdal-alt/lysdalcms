# HANDOFF — Lysdals CMS fundament og [By]Lokalt Nyhedsfrontend

> **Status:** Fase 1 (Fundament: F-01 til F-08) og Fase 2 (Nyhedskernen: P-01 til P-10, K-01 til K-16) er fuldt implementeret og testet. Production Engine og Kontrolrum (2026-10-03) er bygget; se øverste arbejdslog.
> **Dato:** 2026-10-01. **Repo:** `localcms` (Next.js 16).
> **Vigtigt:** Dette repository (`localcms`) er det **eneste førende og opdaterede repo**. Det tidligere `Local2027` er forældet og erstattet af dette.

Denne fil er overleveringsloggen. Læs den FØR du bygger videre — den indeholder
alle beslutninger, Next 16-faldgruber, præcis hvad der er gjort, og de næste trin.

## Arbejdslog — Fase 2: AI-grundlag, kildepakke, artikelgenerator og Local Score (2026-10-03)

**Svar på "hvor står mine prompts, rating osv.?":** `/redaktion/kontrolrum/grundlag` (håndbogen) viser de seks lag, AI'en læser, og linker til hvert lag. Lag 2 er nyt: **redaktionelt grundlag** (`grundlag.medie|principper|vaerdier|koncepter`), indsat i systemprompten efter de låste sikkerhedsregler og før stilen. Tomt grundlag ændrer intet (bevist i `tests/prompts.test.ts`). Rating: `/kontrolrum/score` (vægte, bånd, funktioner, søjler) og `/kontrolrum/kilder` (kilderating A-D). DeepSeek-forbindelsen vises på samme side (nøglen `DEEPSEEK_API_KEY` ligger kun som miljøvariabel).

### Kildepakke (`/kontrolrum/feeds`)
- `FeedDefinition` har nu `kategori`, `prioritet` (1-3 = P0-P2) og hentestatus. Sortér/filtrér/gruppér, massehandlinger, **kildekatalog** (Slagelse 74 og Næstved 93 kilder fra `docs/localrating/source-registries`, genereret af `scripts/gen-feed-catalog.ts` til `lib/feeds/catalog-data.ts`; importeres som inaktive kladder uden adresse), **kopiér pakken til anden by** (kun byer brugeren har adgang til via `lib/instance-access.ts`; kopier er altid slået fra; by-navn kan erstattes).
- **Hent nu** (`lib/feeds/fetch.ts`): manuel hentning af RSS/Atom/JSON Feed og websider (ADR-016: CMS'et henter aldrig af sig selv). Alt går gennem `lib/net/safe-fetch.ts` (SSRF S1-S14, S17 og robots.txt S15; links i feeds hentes aldrig, S16). Signaler lander `maskinindsamlet` og **ugodkendt**. Kun testmiljøer må sætte `FEED_FETCH_LOOPBACK_PORTS` (tillader loopback på de porte); må ALDRIG sættes i drift.
- Nye afhængigheder: `fast-xml-parser`, `cheerio`, `unpdf`.

### Artikelgenerator (`/redaktion/engine/generer`)
- Kilder: feedkort, webadresse (side eller PDF-link), uploadet PDF, indsat tekst. Billeder hentes aldrig; kun adresse, alt-tekst og billedtekst gemmes som reference (rettigheder uafklarede).
- Profiler (redigerbare prompts, kind "generator"): nyhed, citathistorie kort/lang (Local Citation), syntese (Local Syntese), plus fælles regler. Svarformatet er låst.
- **Værn** (`lib/generate/guardrails.ts`, deterministisk): opfundne citater fjernes, tal/tidspunkter/citater i tekst kontrolleres mod kildernes tekst, links/HTML renses, SEO/SoMe/slug normaliseres. Politi/112 (også på domæne) og Krimi/Sundhed er spærret.
- Kørslen gemmes i `GenerationRun` (30 dage), og kladden oprettes ud fra kørslen (aldrig ud fra klientens tekst): status Idé, AI-assisteret, `marking.godkendtAf` tom, kildeuddrag i `ArticleMeta.kilder` til faktatjek i Engine. Intet udgives.
- Afvigelse fra `docs/localrating` D4: AI-udbyder er DeepSeek via den eksisterende gateway.

### Local Score (Y Rating, `lib/score/*`)
- AI estimerer kun 7 dimensioner og 11 funktioner; total, bånd, primær/sekundære funktioner, søjler, format og foreslået prioritet beregnes i `model.ts` ud fra konfigurationen (prompt `rating.scoreConfig`, versioneret). Estimater gemmes i `ScoreRun`, så ændrede vægte slår igennem uden nyt AI-kald. Feedkort har badge, detaljer, sortering og "Vurdér ti".
- Ikke bygget endnu: Local Syntese/Citation som selvstændig chat (Arbejdsrum med `{svar, udkast}`), Business-generatoren, `RatingRun` med den ikke-Y-model `local`, shadow-kørsler. Rating af artikler (kun signaler vurderes).

### Drift
- Migrationer: `feeds_kildepakker`, `generation_run`, `score_run`. Kør `prisma:pg:check`.
- Findes allerede: proxy-429 ved mange samtidige sidehenvisninger i browsertest (`PAGE_RATE_LIMIT_PER_MIN`) er stadig uundersøgt.

## Arbejdslog — Production Engine og Kontrolrum (2026-10-03)

**Formål:** ét arbejdsbord til hele produktionen (signaler ind, skrivning med AI, kvalitets- og faktatjek, ratede kilder, søgning i mere materiale) og et kontrolrum, hvor prompts, kilderating, feeds og ingest styres som redigerbare data. Layoutet er hentet fra Carstens designudkast (tre felter), men bygget i CMS'ets eget designsystem (`--ed-*`/`ui-*`), ikke kopieret 1:1.

### Production Engine — `/redaktion/engine`
- **Venstre: signaler og feeds** (`components/engine/feed-pane.tsx`, `lib/engine/feed.ts`). Faner Signaler / Tip / Arkiv, områdefilter, kort med kilderating A-D, prioritet, "Maskinindsamlet, ikke vurderet" og advarsel ved politi/112. Tip viser aldrig kontaktoplysninger; meddelerens navn kun med `source.viewConfidential`. Arkiv = **emneoverlap** på nøgleord (`lib/engine/archive.ts`), bevidst *ikke* kaldt AI-match.
- **Midten: den eksisterende artikel-editor** i ny `mode="engine"` (`components/editor/article-editor.tsx`). Al logik uændret (autosave, mærkning, AC-01, Krimi/Sundhed-spærring). Kilde- og videnbase-sektionerne er flyttet til copiloten i denne tilstand.
- **Højre: copilot** (`components/engine/copilot.tsx` + `tab-*.tsx`): *Skriv* (AI-forslag, eksisterende opgaver), *Kvalitet* (SEO-score, LIX, rubrikform, AI-rubrikscore), *Fakta*, *Kilder*, *Søg*.
- **Start historie fra signal** (`lib/engine/start.ts`): opretter en kladde (status Idé) med signalet som kilde **inkl. uddrag**; signalets tekst kopieres ikke ind i brødteksten. Idempotent via `Article.externalId = "engine:signal:<id>"`. Politi/112 lægges i Krimi, så AI-tekstforslag er spærret. Ugyldig kilde-URL giver en kladde uden URL, ikke en fejl.
- **Faktatjek mod originalkilder** (`lib/engine/claims.ts`): deterministisk (ingen AI) kontrol af tal, klokkeslæt og **ordrette citater** mod kildernes uddrag. "Står i kilden" betyder kun, at ordlyden findes dér. AI-faktatjekket får samme uddrag som data og kan aldrig give grøn uden uddrag.
- **Kilderating** (`lib/engine/source-rating.ts`): score 0-100 -> A (>=80), B (>=60), C (>=40), D. Rækkefølge: redaktørens karakter på kilden > kilderegisteret (domæne, så navn) > indbyggede regler (kildetype, kendte værter, nyhedsbureauer) > C. Plus kildegrundlags-tjek (primærkilde, flere kilder, uddrag, personfølsomhed) som **advarsler, ikke blokering**.
- **Søg** (`lib/engine/material.ts`): egne artikler, signaler, tip, meddelersager og emner for den aktive by (rate-limited), plus det eksisterende vidensarkiv. Signaler og publicerede artikler kan lægges på historien som kilde.
- **Interne kildefelter** `uddrag`, `type`, `rating` ligger på `ArticleMeta.kilder` (Json, ingen migration). De udgives **aldrig**: schema.org-citationen bruger kun titel/url/udgiver/dato (bevist i `tests/engine-server.test.ts`).

### Kontrolrum — `/redaktion/kontrolrum`
- Ny rettighed **`controlroom.manage`** (Ansvarshavende redaktør, Teknisk produktansvarlig). **Kør `npm run roles:sync` efter deploy**, og lad brugerne logge ind igen. Ingest-siden kræver den eksisterende `ingest.manage`.
- **Prompts** (`lib/prompts/*`): register over alle 15 AI-opgaver + sprog/stil + to tillægslag + to ratingprompts. Standardteksterne ligger nu i `lib/prompts/defaults.ts`. Tilretninger gemmes pr. by (`PromptTemplate`) med uforanderlig historik (`PromptRevision`), diff mod standard, "sådan ser modellen den", samtidighedstjek (`baseVersion`) og gendannelse. **Låst i koden:** sikkerhedsreglerne og hver opgaves svarformat. Uden tilretninger er systemprompten og 12 af 13 opgaveprompts bytte-for-bytte uændrede (fingeraftryk i `tests/prompts.test.ts`); kun faktatjek er bevidst udvidet.
- **Ratingprompts** (nye AI-opgaver `headlineRating`, `sourceRating`): foreslår score med delscorer/faktorer. Ikke tekstgenererende, så de virker også i Krimi/Sundhed. Rubrikscoren er AI's vurdering ud fra teksten, *ikke* målt klikrate. AI kan ikke slå kilder op og vurderer kun ud fra det, den får.
- **Kilder og rating** (`SourceProfile`): kilderegister med score, domæne, note, "prøv ratingen", import af standardkilder (idempotent).
- **Feeds** (`FeedDefinition`): hvad agenterne skal overvåge. **CMS'et henter ikke selv feeds:** agenten læser de aktive feeds med `GET /api/ingest/feeds` (scope `signals:write`) og leverer signaler som før.
- **Ingest:** den manglende side til de eksisterende nøgle-handlinger (opret/tilbagekald, vis nøglen én gang) + status og endpoints.
- AI-auditloggen får `tilpasset` (nøgler på tilretninger i brug); `promptVersion` får `+tilpasset`. Auditlog for kontrolrummet indeholder aldrig promptindhold, URL'er eller noter.

### Datamodel og drift
- Migration `20261003201443_kontrolrum_prompts_kilder_feeds` (kun `CREATE`, additiv): `PromptTemplate`, `PromptRevision`, `SourceProfile`, `FeedDefinition`. SQLite: `npx prisma db push`; Postgres: `prisma migrate deploy` (kører ved opstart).
- Navigation: "Production Engine" er første punkt under Indhold; ny gruppe "Kontrolrum". Landingsside efter login er uændret (`/redaktion/artikler`).

### Kvalitetskontrol
- 777 tests grønne (726 før; +51 i `engine-core`, `engine-server`, `prompts`, `control-room` + opdateret `redaktion-access`). `npx tsc --noEmit` ren. `npm run lint`: 0 fejl, 66 advarsler (budget 76). `npm run build` grøn (nye ruter: engine, kontrolrum + 4 undersider).
- Browser (Chromium, produktionsbuild): Engine og alle Kontrolrum-sider på 1440 px, Engine på 375 px; tal/tid/citater-kontrollen verificeret mod et rigtigt signal; ingen konsolfejl. Bot-beskyttelsen i `proxy.ts` giver 429 til headless-UA'er; brug en almindelig UA i automatiske tests.

### Fundet undervejs (ikke rettet her)
- `proxy.ts` giver `429 Too many requests` efter ca. 300 sider/min pr. IP, og **forhåndshentninger (Next `<Link>`-prefetch) ser ud til at tælle med**: ved første 429 i en browser-test var der sendt 13 sider + ca. 290 prefetch på ét minut (redaktionens sidebar har ca. 28 links). En hurtig redaktør kan derfor få 429. Production Engines filterlinks har `prefetch={false}` for ikke at forværre det. Test med `PAGE_RATE_LIMIT_PER_MIN=5000`, og undersøg prefetch-detektionen i `proxy.ts` (linje ~110) som egen opgave.

### Bevidst ikke bygget (næste skridt)
- "Kvik-publicér telegram" fra designudkastet (omgår godkendelse/mærkning), partshøring som gemt tjekpunkt, læsertalsbaseret "estimeret CTR" (ville være opdigtet), CMS-drevet RSS-hentning, "Afprøv prompt" mod en testtekst, indsæt-som-citatblok fra tip.
- Prompts til frontforside-AI, chat og operatør ligger stadig i kode (`lib/frontpage/ai-*.ts`, `lib/operator/prompt.ts`) og kan føjes til registret efter samme mønster.

## Arbejdslog — Claude Design Forsideimplementering (Option 2a / 2b, 2026-09-30)

- **Implementeret `SlagelseLokalt Forside.dc.html` (Option 2a & 2b):**
  - **Typografi & Skrifttyper:**
    - Erstattet standard fonte med Google Fonts `Newsreader` (serif til overskrifter, display og manchet) og `Inter` (sans-serif til UI, kickers, knapper og metadata) jf. Claude Design lærredet.
    - Kortoverskrifter sat med `Newsreader` (44px hovedhistorie, 22px standard, 26px annonce), balancerede linjer og avis-æstetik.
  - **Zone 2 Bento Hero (12 kolonner):**
    - 8-kolonne hovedhistorie med 3:2 fotoplacering, Newsreader 44px display overskrift, manchet og læsetidsestimat.
    - 4-kolonne stacket sekundær sektion (partnerfinansieret kort `#E3ECF2` + redaktionel tophistorie).
  - **Zone 3 ("Fra dit område"):**
    - 3-kolonne bento-grid med områdevælgerpiller og 3:2 billeder.
  - **3-Kolonne Feature-række (Option 2a Signature):**
    - `AiShortNewsBox.tsx`: "KORT NYT" med stiplet ramme, `✦ AI-ASSISTERET` badge, tidsangivelser, kildehenvisning og AI-transparens link.
    - `CitizenStoriesBox.tsx`: "FRA BORGERNE" med `#E7EBDD` baggrund, `▣ INDSENDT` badge, 54px thumbnails og direkte link til `/indsend`.
    - `WeekendCalendar.tsx`: "I DAG OG I WEEKENDEN" med farvede dato-piller (f.eks. `03 OKT`), lokale arrangementer tilpasset den aktuelle kommune og link til `/kalender`.
  - **In-Feed First-party Annonce (`FirstPartyAd.tsx`):**
    - Opdateret til Option 2a format: `#FCE8A6` baggrund, `#4D3900` tekst, `2px solid #B8860B` med 6px guldkant i toppen, `ANNONCE` badge, Newsreader overskrift og pill-CTA.
  - **Header & Branding (`SiteHeader.tsx`):**
    - Newsreader logo med accent-farvet `Lokalt` (f.eks. `Slagelse`<span style="color:var(--site-accent)">Lokalt</span>).
    - Områdevælger-pille `◉ [By] ▾` direkte ved siden af logoet koblet til byskifteren.
    - "Indsend historie" pill-knap i accentfarve.
    - 3px dekorativ accent-progresslinie under headeren.
  - **Fyrtårnspartnere Strip (`BeaconPartners.tsx`):**
    - `FYRTÅRNSPARTNERE · MED TIL AT GØRE LOKALJOURNALISTIK MULIG` stribe med 5 lokale partnerkort tilpasset hver kommune.
  - **Mobil Bundnavigation (`BottomNav.tsx`):**
    - Flydende frosted-glass bundmenu jf. Option 2b (`backdrop-filter: blur(18px); border-radius: 24px; box-shadow: 0 8px 24px rgba(30, 26, 22, 0.14)`).
  - **Mikrointeraktioner & Elevation (`.b`):**
    - `.b:hover` elevation med `transform: translateY(-2px); box-shadow: 0 4px 14px rgba(30, 26, 22, 0.14)`.
- **Kvalitetskontrol:**
  - 40/40 tests grønne (`npm test`).
  - `npx tsc --noEmit` 0 fejl.
  - `npm run lint` 0 fejl.
  - `npm run build` bygger 42 routes fejlfrit.

## Arbejdslog — Netværkssites & Multi-site (N-02, N-04, 2026-09-30)

- **Kreeret og seedet alle 5 øvrige hovedsites:**
  1. **NæstvedLokalt** (`naestvedlokalt.dk`, id: `naestved-site`): Accent Fjord `#1F5663` (kontrast 8,2:1), 8 delområder (Næstved By, Karrebæksminde, Fuglebjerg m.fl.), 10 realistiske lokale artikler, 3 forfattere og lokale brugere.
  2. **HolbækLokalt** (`holbaeklokalt.dk`, id: `holbaek-site`): Accent Mos `#4F5B1E` (kontrast 7,4:1), 8 delområder (Holbæk By, Jyderup, Tølløse, Orø m.fl.), 10 realistiske artikler, 3 forfattere.
  3. **RingstedLokalt** (`ringstedlokalt.dk`, id: `ringsted-site`): Accent Skov `#24533A`, 8 delområder (Ringsted By, Benløse, Jystrup, Kværkeby m.fl.), 10 realistiske artikler, 2 forfattere.
  4. **KøgeLokalt** (`koegelokalt.dk`, id: `koege-site`): Accent Okker `#8A5A00` (kontrast 5,9:1; adskilt fra Holbæks Mos), 8 delområder (Køge By, Køge Nord, Herfølge, Borup m.fl.), 10 realistiske artikler, 3 forfattere.
  5. **RoskildeLokalt** (`roskildelokalt.dk`, id: `roskilde-site`): Accent Lyng `#6A3553` (kontrast 9,4:1), 8 delområder (Roskilde By, Trekroner, Jyllinge, Viby Sjælland m.fl.), 10 realistiske artikler, 3 forfattere.
- **Multi-site arkitektur & Site-switching:**
  - `getCurrentSite()` udvidet til at understøtte både host-header, `.localhost`-subdomæner, dev-cookie `site` og fallback til `slagelselokalt.dk`.
  - Dedikeret switch endpoint `/api/site/switch?site=...&redirect=...` gør det muligt at skifte site øjeblikkeligt med ét klik via cookie.
  - Client-safe `cms/lib/network-sites.ts` udskilt (uden `@prisma/client`-afhængigheder), så client-komponenter sikkert kan rendere netværksoversigter.
  - **Interaktiv by-vælger i headeren:**
    - "Skift by ▾"-dropdown integreret direkte ved siden af logoet i `SiteHeader.tsx` med klik-udenfor-lukning, Escape-tast, farvekoder for hver by, aktiv-indikator og hover-effekter.
    - Netværksbar øverst på siden med direkte genveje og farvede status-dots.
    - Mobil-skuffe (`SectionSheet.tsx`) med dedikeret netværkssektion og farvedots for hurtigt byskifte på mobile enheder.
    - Netværkslinks i footeren (`SiteFooter.tsx`), der forbinder alle 6 sites indbyrdes.
  - Hver instans indeholder automatisk de 5 øvrige sites i sit `netvaerk`-felt.
- **Kvalitetskontrol:**
  - 40 tests (`npm test` 100% grøn inkl. nye `network-sites.test.ts`).
  - `npx tsc --noEmit` 0 fejl.
  - `npm run lint` 0 fejl.
  - `npm run build` bygger 42 routes fejlfrit.

## Arbejdslog — Fase 5: Indsendelse & Nyhedsbrev (P-15, P-16, A-07, A-08, A-09, 2026-09-30)

- **P-15 (Offentlig formular `/indsend`):**
  - Borgerindsendelsesformular med honeypot-spamværn, områdevalg, foto-angivelse samt lovpligtig bekræftelse af rettigheder og samtykke.
  - Server action `submitCitizenProposal` med Zod-validering og automatisk status som `Ny` i databasen. Ingen autopublicering.
- **A-07 (Redaktionel indbakke `/redaktion/indbakke`):**
  - Komplet indbakkestyring med statusfiltre (Nye, Under behandling, Artikel oprettet, Afvist), interne arbejdsnoter og fuld visning af afsender- og samtykkedata.
  - 1-klik "Opret artikel fra indsendelse": Genererer automatisk artikeludkast med `indholdstype: "Brugerindsendt"`, udfylder afsendermærkning og linker direkte til editoren.
- **P-16 (Nyhedsbrevstilmelding `/nyhedsbrev` & moduler):**
  - Dedikeret tilmeldingsside med præferencer for lokalområde og sektionsinteresse. 0% tredjepartstracking, 100% first-party.
  - `NewsletterSignup.tsx` på forsiden og artikelsider forbundet direkte til `subscribeToNewsletter`-action.
- **A-08 (Abonnentadministration `/redaktion/nyhedsbrev`):**
  - Administrationsliste over abonnenter med søgning, status-toggle, manuel tilføjelse og KPI-kort over aktive abonnenter.
  - CSV-eksport `/api/nyhedsbrev/export` med UTF-8 BOM og semikolon til Excel/Numbers.
- **A-09 (Spor A-markering):**
  - Forankret `Brugerindsendt`-mærkning og automatisk visning i forsidens Zone 5 ("Fra borgerne").
- **Kommende integration:**
  - Carstens eget meddeler-værktøj kobles på til tip og kilder via API i stedet for den simple formular, jf. brugerbeslutning.
- **Test & Typecheck:**
  - 35 tests (`npm test` 100% grøn), `npx tsc --noEmit` grøn, `npm run lint` 0 fejl.

## Arbejdslog — Fase 4: Redaktionel styring & Forsidestyring (A-01…A-06, 2026-09-30)

- **A-03 (Forsidestyring `/redaktion/forside`):**
  - Dedikeret forside-curation interface (`FrontpageManager.tsx`) med visuelt overblik over Zone 1 (Hovedhistorie), Zone 2 (Sekundære tophistorier) og Zone 3 (Områdefokus).
  - Fastgørelse med udløb: Artikler kan fastgøres med tidsbegrænsning (12t, 24t, 48t, 7 dage el. permanent).
  - Frigivelse: Ét klik på "Frigiv zone" sletter `FrontpagePlacement`, hvorefter zonen øjeblikkeligt overtages af den dynamiske distributionsmotor.
- **A-04 (Kvoteloft-advarsel):**
  - Live beregning af støtte- og sponsoreret andel via `calculateSupportedContentQuota()`. Tydelig advarselsbanner hvis andel ≥ 25%, og server-blockering mod fastgørelse af yderligere kommercielt indhold i topzonen.
- **A-02 (Områdeadministration `/redaktion/omraader`):**
  - Komplet CRUD-interface til delområder (`GeoTag`) med slug, koordinater (lat/lng) og artikel-tæller.
- **A-01 & A-05 & A-06:** Sektionsadministration, rettelser i editoren og AI-assisteret mærkning er verificeret og aktive.
- **Testsuite:** 31 tests (`npm test` 100% grøn). `npm run lint`, `npx tsc --noEmit` og `npm run build` er grønne på alle 36 routes.

## Arbejdslog — Agentisk Ad-Generator, First-Party Metrik-Motor & Algoritmisk Indholdsfordeling (2026-09-30)

- **Etape A: First-Party Metrikker & Performance Dashboard (`/redaktion/metrikker`):**
  - Datamodel: `ArticleMetric` oprettet med `visninger`, `laesninger` (scroll > 70%), `totalLaesetidSek`, `hourlyViews` og dynamisk `score`.
  - Client Tracker: `components/site/MetricTracker.tsx` (cookiefri, <2KB, måler reel opmærksomhedstid via `visibilitychange` og scroll-dybde).
  - API Route: `/api/metrics/track` håndterer beacon-opdateringer atomisk og genberegner dynamisk distributionsscore.
  - Dashboard: `/redaktion/metrikker` med samlet læsetid, gennemlæsningsrate, gns. læsetid, kvotelofts-vagt og realtids-fordelingssimulator.
  - Navigation: "Metrikker" tilføjet i admin sidebaren.

- **Etape B: Den Intelligente Indholdsfordelingsmotor:**
  - Bibliotek: `lib/distribution-engine.ts` implementerer scoring-formel: `Score = (Base * Decay) + (Velocity * Decay) + DaypartBonus + GeoBonus`.
  - Decay: Halveringstid på 12 timer for nyheder/sport, 36 timer for baggrund/kultur. Breaking holdes ultra-frisk de første 3 timer.
  - Dayparting: Subtil, dynamisk vægtning efter døgnrytme (morgen kl. 06–09 = nyheder, middag kl. 11–14 = erhverv/debat, aften kl. 16–22 = kultur/sport).
  - Geografisk diversitet: Geobonus (+15) til områder uden for Slagelse By (Korsør, Skælskør osv.).
  - Kvoteloft: Håndhæver maks. 25% betalt indhold i topzonen og advarer redaktøren.
  - Integration: `getFrontpageData()` i `lib/site-queries.ts` udvælger tophistorier og sekundære kandidater vha. motoren.

- **Etape C: Agentisk Banner- og Ad-Generator (`/redaktion/annoncer`):**
  - Datamodel: `AdCampaign` med formater (`IN_FEED_BANNER`, `EVENT_POST`, `NATIVE_PREMIUM`), priser, zoner og `kreativData`.
  - Priser og mål: Bygger på Min By Media / MigogAalborg (In-feed display 3.500 kr./uge, Event post 499 kr., Native premium 14.500 kr.).
  - Ad-Generator Tool: `/redaktion/annoncer` med interaktiv form (`AdGeneratorForm.tsx`), 1-klik AI-vinkelgenerering, live SVG/HTML-forhåndsvisning og automatisk ANNONCE-mærkning (rav-ramme `#B8860B`).
  - First-Party Ad Serving: `components/site/FirstPartyAd.tsx` renderer annoncer i frontenden uden 3. parts ad-netværk eller cookies.
  - Ad Tracking: `/api/ads/track` måler visninger og klik first-party.
  - Forsideintegration: Aktiv in-feed banner renderes diskret mellem top- og mid-sektion på forsiden.
  - Testsuite: 28 tests (`npm test` 100% grøn). `npm run lint`, `npx tsc --noEmit` og `npm run build` er grønne.

## Arbejdslog — Fase 1 (Fundament) & Fase 2 (Nyhedskernen), 2026-09-29

### 1. Fundament (Fase 1: F-01 til F-08)
- **F-01 (Admin-flytning):** Redaktions-interfacet er flyttet fra `cms/app/(admin)` til `cms/app/redaktion/*`. `proxy.ts` beskytter `["/redaktion/:path*", "/partner/:path*"]`. Login omdirigerer til `/redaktion/artikler`.
- **F-02 (Site lookup):** `cms/lib/site.ts` implementerer cached `getCurrentSite()` med host-header resolution, dev/localhost fallback til `slagelselokalt.dk`, og `parseSiteColors`.
- **F-03 & F-04 (Designsystem & Fonte):** `cms/styles/site.css` oprettet med alle tokens fra `DESIGN.md` §2 & §10. Skrifttyperne **Bricolage Grotesque** (display/overskrifter/badges) og **Literata** (brødtekst/manchet) integreret via `next/font/google`. Kun lys tilstand (`color-scheme: light`).
- **F-05 & F-06 (Prisma & Taksonomi):** `Category` udvidet med `parentId`, `sortering`, `beskrivelse`, `iNavigation`. `GeoTag` udvidet med `slug`, `lat`, `lng`. `Author` og `Tag` udvidet med `slug`. `Instance` udvidet med `kvoteloftProcent`, `sideTekster`, `netvaerk`. Taksonomi-validering i `lib/taxonomy.ts` (maks 2 niveauer).
- **F-07 (Mærkningshåndhævelse):** `lib/marking.ts` og `lib/blocks/schema.ts` udvidet med alle 5 mærkede indholdstyper (`Partner`, `Sponsoreret`, `Brugerindsendt`, `AI-assisteret`, `PR`). Kilde-URL og dato kræves på citater i AI-assisterede artikler. AI-artikler blokeres i Krimi og Sundhed.
- **F-08 (Seed & aktiver):** 47 realistiske artikler oprettet på tværs af alle 6 sektioner, 26 undersektioner, 8 Slagelse-områder og 4 forfattere. Lokale SVG-aktiver i `public/media/` og `public/avatars/`.

### 2. Nyhedskernen (Fase 2: P-01 til P-10, K-01 til K-16)
- **K-01 (SiteHeader):** Ordmærke, handlinger (Søg, Indsend tip, Bliv støtte), vandret sektionsbar med scroll og aktiv accent-underlinje. Skip-link til `#hovedindhold`.
- **K-02 & K-03 (BottomNav & SectionSheet):** Mobilnavigation under 1024px med safe-area padding. "Sektioner" åbner fuldt tilgængeligt modal bottom-sheet med sektioner, undersektioner, områder og om-links.
- **K-04 (SiteFooter):** Fire-kolonne footer med vision, sektioner, deltagelse, om-mediet, presseetisk deklaration, disclaimer og netværkslinks til søstersites.
- **K-05 (ArticleCard):** 4 varianter (`hoved`, `standard`, `kompakt`, `tekst`). Klikbar via `::after` på titel-linket. Understøtter alle mærkninger, breaking-badge, relativ tid og forfatterportræt på Debat-sektionen.
- **K-06 (ContentLabel & MarkingBox):** Mærkningsbadges på kort samt fuld forklarende boks øverst i artikler iht. `governance.md §1`.
- **K-07 (SectionHeader):** H1, vandret scrollende undersektionspiller ("Alle" + underkategorier) og områdefilter-dropdown (`?omraade=`).
- **K-08 & K-09 (LatestTicker & ShortNewsList):** Seneste nyt ticker med pulserende prik samt zone 4 "Kort nyt"-liste med tæt typografi.
- **K-10, K-11 & K-12 (Byline, DateDivider, LoadMore):** Forfatterfoto (40px), publiceret/opdateret tid, datomarkører ("I dag", "I går", ugedag) og "Vis flere"-knap med URL-paginering.
- **K-15 & K-16 (Breadcrumbs & SiteBlockRenderer):** Semantisk brødkrumme med schema.org JSON-LD samt dedikeret offentlig blok-renderer til artiklers 8 bloktyper (afsnit, headings, 16:9/3:2 billeder med kredit, citater med kildehenvisning, lister og faktabokse).
- **P-01 (Forside `/`):** Bygget efter `DESIGN.md` §6a.4 zoner: Zone 1 (Seneste nyt) → Zone 2 (Tophistorie) → Zone 3 (Område) + Zone 4 (Kort nyt) → Zone 7 (Sektionsblokke for Nyheder, Sport, Erhverv, Kultur, Foreningsliv, Debat) → Zone 5 (Fra borgerne) → Zone 10 (Nyhedsbrev).
- **P-02 (Sektionsside `/[sektion]`):** H1, pillebar, områdefilter, 1+2 top, undersektionsblokke (side 1), kronologisk liste med datomarkører og desktop sidespalte ("Mest læst" + nyhedsbrev).
- **P-03 & P-04 (Undersektion & Artikelside `/[sektion]/[slug]`):** Intelligent router der detekterer undersektioner vs. artikler. Artikelsiden indeholder brødkrumme, mærkningsboks, H1, manchet, byline, coverbillede, brødtekstblokke, emne-/områdetags, relaterede artikler, nyhedsbrev og `NewsArticle` schema JSON-LD.
- **P-05 (Områdeside `/omraade/[slug]`):** Lokal side for Korsør, Skælskør osv. med filtrerede artikler og datomarkører.
- **P-06 (Emneside `/emne/[slug]`):** Emneside baseret på Tag.
- **P-07 (Forfatterside `/forfatter/[slug]`):** Journalistprofil med portræt, bio og publicerede artikler.
- **P-08 (Søgning `/soeg`):** Fritekstsøgning med filtre på sektion og område.
- **P-09 (404-side):** Pæn fejlside i sitets design med navigation tilbage.
- **P-10 (RSS-feeds):** `/feed.xml` og `/[sektion]/feed.xml` genererer valid RSS 2.0 XML.
- **Kvalitetskontrol:** Testsuite udvidet til 21 tests (`npm test` passer 100%). `npm run lint` har 0 fejl, `npx tsc --noEmit` har 0 fejl, `npm run build` bygger fejlfrit alle 22 routes.

## Driftslog — lokal ejerbruger, 2026-08-03

- Lokal ejerbruger `carstenlysdal@gmail.com` er oprettet/opdateret i SQLite-databasen som `Carsten Lysdal`.
- Brugeren er knyttet til rollen `Ansvarshavende redaktør` og en fast forfatterprofil.
- Login og password-hash er verificeret. Kodeordet er bevidst ikke gemt i Git eller denne handoff.
- Ændringen er lokal driftsdata og overlever ikke en sletning eller ny seedning af `prisma/dev.db`.

## Arbejdslog — CMS-06 opgaver og honorarer v1, 2026-08-03

- `Assignment`, `HonorRate` og `HonorEntry` tilføjet som instansafgrænsede modeller med én-til-én-kobling mellem opgave, artikel og honorarpost.
- `/opgaver`: søgning, statusfilter, direkte tildeling, opgavepulje, research-/afleveringsdeadline, artikel-/støtteaftalekobling og estimeret honorar.
- Journalister kan tage puljeopgaver og flytte egne opgaver fra Tildelt → I gang → Afleveret. Aflevering kræver eksplicit interessekonflikterklæring.
- Redaktionel ledelse kan administrere opgaver, returnere afleveringer og godkende/annullere. Deadlinevisningen markerer ≤48 timer og overskridelser.
- Konfigurerbar prisliste seedet fra kravspecifikationen med minimum, maksimum og standardbeløb.
- Artikelpublicering og honorarpostering kører atomisk: en koblet freelanceopgave godkendes og får præcis én honorarpost via unik constraint/upsert.
- `/honorar`: samlet ledelsesview, journalistens egne honorarer, godkendelseshandling og bogføringsklar semikolonsepareret UTF-8 CSV.
- Runtime-verificeret med redaktør og journalist: publicering → opgave Godkendt → 800 kr. Afventer → Godkendt → CSV.
- Testsuiten er udvidet til 11 tests med opgavevalidering, roller, transitions, deadlines og honorarberegning.

---

## Arbejdslog — Y Business-redesign + UI-polish, 2026-08-03

- Designsystemet er skiftet fra Modernist (Archivo, rød-orange) til Y Business-paletten.
- **Fonte**: Schibsted Grotesk (brødtekst), Playfair Display (headings, serif italic), JetBrains Mono (labels, tags, tabelheder) via `next/font/google`.
- **Farver**: Aubergine accent `#361352`, warm paper baggrund `#FAFAF8`, hvide kortflader, accent-baserede skygger.
- **Komponenter**: pill-tags (9999px), nav-underline-animation (scaleX), kort-bundlinje-hover, forfatteravatar-cirkler, inline BREAKING-badge, quick-filter pills.
- **Status-dots**: grøn (publiceret), amber (planlagt), grå (kladde/arkiv) — Y Business-semantik.
- Nav: aktiv side markeres via `aria-current` + underline-animation. "Indstillinger" fjernet.
- CMS-XX eyebrows fjernet fra alle sider. Block-editor: tom-tilstand + delete-bekræftelse. Success-besked auto-forsvinder.

## Arbejdslog — AI Chat, Emner og Signaler, 2026-08-03

### AI Chat (`/chat`)
- Ny `ChatMessage`-model i Prisma: `sessionId`, `role`, `content`, `instansId`, `userId`.
- Streaming API-route `POST /api/chat` med Anthropic SDK (`claude-sonnet-4-6`), prompt caching via systembesked, fuld samtalehistorik (op til 20 beskeder).
- To tilstande: **Spørg** (research/undersøgelse) og **Auto** (redaktionel assistent).
- Client-side streaming med `ReadableStream`, realtids-tekst i chat-bobler.
- Kontekstuelle prompt-chips på startsiden. Chathistorik bevares på tværs af sessioner via `?session=`-param.
- `@anthropic-ai/sdk` installeret.

### Emner (`/emner`)
- Ny `Topic`-model: `titel`, `beskrivelse`, `coverUrl`, `kategorier` (JSON string[]), `notable`, `kildeAntal`.
- Kortgrid med 16:9 cover-billede, NOTABLE-badge, kategori-tags, kildeantal, relativ tid.
- Kategorifilterchips genereres dynamisk fra eksisterende emner.
- Nyt emne-formular på `/emner/ny`. Emner kan åbnes direkte i Chat med `?emne=`-param.

### Signaler (`/signaler`)
- Ny `Signal`-model: `overskrift`, `brødtekst`, `kilde`, `kildeUrl`, `notable`, `breaking`, `laest`, `version`.
- Live pulserende dot (CSS animation). Feed sorteret nyeste først, 100 signaler max.
- Kildefilter (Alle/Ritzau/Reuters/AP/Intern), "Vis læste" toggle.
- "Markér alle læst" server action. Hvert signal har "Skriv"-knap der åbner Chat med signal som kontekst.
- Redaktører kan tilføje signaler manuelt via `<details>`-formular.

### Navigation
- Nav-links: Publishing · Signaler · Emner · Skriv · Medier · Opgaver · Honorar.

### Næste anbefalede arbejde

1. CMS-07 offentlig indsendelsesformular og redaktionel indbakke.
2. Notifikationskanal til automatiske 48/12-timers deadlinepåmindelser (UI-advarsler er med; e-mail/push er ikke).
3. Månedlig fakturakørsel med eksportbatch-ID og bogføringsintegration.

---

## Arbejdslog — CMS-03 mediebibliotek v1, 2026-08-03

- `Media` udvidet med filnavn, MIME-type, størrelse, dimensioner, licens, rettighedsudløb, kildetype og opdateringstid.
- `Article.coverMedia` tilføjet som relation; cover returneres i det offentlige læse-API.
- Centralt `/medier`-bibliotek med søgning, typefilter, preview, metadataredigering samt rettighedsstyring.
- Sikker upload på maks. 10 MB. JPG/PNG/WebP valideres med Sharp, auto-orienteres, nedskaleres til maks. 2400×2400 og gemmes som WebP.
- Eksterne billeder, videoer, lydfiler og dokumenter kan registreres via URL.
- Billedblokke vælger nu genbrugelige medier fra biblioteket; rå URL er fortsat mulig. Artikel-editoren har covervælger.
- Billeder blokeres uden alt-tekst og billedtekst. Lokale uploads ignoreres af Git og bruger `public/uploads` som dev-adapter.
- Multi-instance-hærdning: kategori, forfatter, tags, geotags og covermedie valideres mod brugerens instans ved artikellagring.
- Automatiske Node-tests tilføjet for AC-01, publiceringsret, blok-URL'er, billedmetadata, rettighedsdato og reel WebP-optimering.
- Direkte Sharp-afhængighed er opgraderet til 0.35.3. `npm audit --omit=dev` rapporterer fortsat tre high-advisories i **Next 16.2.12's egne indlejrede** PostCSS/Sharp-versioner; npm's foreslåede force-fix vil fejlagtigt nedgradere til Next 9.3.3 og må ikke bruges. Opgradér Next, når en stabil rettet version efter 16.2.12 er tilgængelig, og genkør audit.

### Næste anbefalede arbejde efter CMS-03 v1

1. Manuel browser-QA af upload, medievælger og responsive layouts.
2. Produktions-storage-adapter til S3/R2 med signed uploads og oprydning af ubrugte filer.
3. Fortsæt med CMS-06 opgave-/honorarmodul eller CMS-07 indsendt materiale.

---

## Seneste arbejdslog — 2026-08-03

Den afbrudte byggeproces er fortsat og fundament-backloggen er gennemført:

- Prisma-client og SQLite-database oprettet; idempotent seed med referenceinstans, taksonomi, roller, redaktør/journalist og to demoartikler.
- Auth.js credentials/JWT, login, Next 16 `proxy.ts`, beskyttet admin-layout og databasebaseret RBAC.
- Workflow, serverhåndhævet publiceringsret, AI-brugscheck, AC-01-mærkningsblokering og revisionssnapshot.
- Zod-valideret blokregister og blokeditor (TipTap til brødtekst) for de otte aftalte MVP-blokke.
- Publiceringsoversigt med søgning, filtre, faner, BREAKING/FASTGJORT/ALLE og forsidehandlinger.
- Artikeloprettelse/redigering med taksonomi, mærkning, AI-brug og SEO-sidepanel.
- Offentligt `GET /api/articles` og `/api/articles/[slug]`, begge begrænset til `Publiceret`.
- README opdateret. `npm run lint`, `npx tsc --noEmit` og `npm run build` gennemført; build er grøn.

Demo-login: `redaktoer@slagelse.test` eller `journalist@slagelse.test`, adgangskode = `SEED_DEMO_PASSWORD` (sat ved seed; den hardkodede demo-adgangskode er fjernet).

### Næste anbefalede arbejde

1. Manuel browser-QA af login, editor, mobil-layout og AC-01-dialog.
2. Tilføj automatiske tests for workflow/marking og integrationstest af læse-API.
3. Vælg næste roadmap-modul: mediebibliotek er den mest naturlige fortsættelse, fordi billedblokken aktuelt bruger URL-felt.

Alt nedenfor er den oprindelige handoff og bevares som beslutningshistorik. Den seneste arbejdslog ovenfor er autoritativ om implementeringsstatus.

---

## 0. Det store billede

Bygger **Lysdals CMS** — et generisk, AI-understøttet redaktionelt CMS ud fra en
komplet kravspec i `../files/` (især `03-cms-og-ai-kravspecifikation.md`).
**Første leverance = fundamentet**, så moduler tilføjes i senere sessioner.

**Valg (godkendt af bruger):**
- Tech: **Custom Next.js full-stack** (App Router, TS) + Prisma + Auth.js v5 + Tailwind v4.
- Scope: **fundament først**, så moduler.
- Placering: ny `cms/`-mappe i Local2027 (eget git-repo, scaffolded).
- Design: **Modernist** designsystem (Claude Design-projekt) — UI-lag for hele cms'et.
- Database: **SQLite til dev** (ingen Postgres/Docker på maskinen), cross-provider schema.

**Godkendt plan:** `/Users/Lysdal/.claude/plans/nifty-mapping-yao.md` (læs den for fuld kontekst).

---

## 1. ✅ Hvad er gjort

1. **Scaffold:** `create-next-app` kørt → Next **16.2.12**, React 19.2, Tailwind v4.
2. **Afhængigheder installeret:** prisma, @prisma/client (v7), next-auth **5.0.0-beta.32**,
   @auth/prisma-adapter, bcryptjs, zod (**v4**), lucide-react, @tiptap/react+starter-kit+pm.
   Dev: @types/bcryptjs, tsx.
3. **Designsystem vendoret:** `styles/modernist.css` (source of truth, kopieret fra
   Claude Design-projekt "Modernist"). Udvidet med få egne klasser: `.btn-danger`,
   `.tag-success/.tag-warn`, `.dot-status*`.
4. **globals.css:** importerer Tailwind + modernist, `@theme inline`-bro så Tailwind
   utilities (`text-accent`, `bg-surface`, `border-divider`, `font-heading`) peger på
   Modernist-tokens.
5. **app/layout.tsx:** Archivo via `next/font/google` (400/600/800), bundet til
   `--font-body`/`--font-heading`, `lang="da"`.
6. **.env / .env.example:** oprettet. `DATABASE_URL="file:./dev.db"`, `AUTH_SECRET`
   genereret og sat i `.env`. Scripts tilføjet package.json (`db:push`, `db:migrate`,
   `seed`, `db:studio`, `postinstall: prisma generate`).
7. **prisma/schema.prisma:** fuld datamodel skrevet (Instance, Role, User, Author,
   Category, Tag, GeoTag, Article, ArticleRevision, Media, SupportAgreement, Organization).
   Enums som String + TS-unioner; lister som Json/relationer (cross-provider).

## 2. Oprindelig backlog (nu gennemført; historik)

**Næste skridt = kør `npx prisma db push` (eller generate) for at oprette SQLite-DB +
client.** Derefter bygges disse libs/sider (allerede designet i planen):

8. `lib/db.ts` — Prisma client singleton.
9. **Auth + RBAC:**
   - `lib/auth.ts` — Auth.js v5 config (credentials-provider, JWT-strategy, Prisma adapter
     ELLER simpel credentials uden adapter da SQLite). `auth`, `handlers`, `signIn`, `signOut`.
   - `app/api/auth/[...nextauth]/route.ts` — `export { GET, POST } = handlers`.
   - `proxy.ts` (se Next 16-note!) — beskytter `/admin`-routes (optimistic check), redirect til login.
   - `lib/permissions.ts` — `PERMISSIONS`-konstanter + `can(user, perm)`.
10. `lib/workflow.ts` — status-enum (spec 5.2-listen) + `canTransition` + hvem-må-flytte-hvad (del 2 afsnit 3.2).
11. `lib/marking.ts` — **AC-01**: bloker publicering hvis `indholdstype ∈ {Partner,Sponsoreret}` og `marking` tom/ufuldstændig.
12. `lib/blocks/` — `schema.ts` (zod per bloktype), `registry.ts`, `renderer.tsx`.
    MVP-blokke: paragraph (TipTap inline), heading, subheading, manchet, quote, factbox, image, infobox.
13. `prisma/seed.ts` — Slagelse-instans (som DATA), standardtaksonomi, roller fra del 2 afsnit 6,
    testbrugere: redaktør (publish-rettighed) + journalist (ingen publish). Hash passwords med bcryptjs.
14. **Admin-UI** (`app/(admin)/`): layout med `.nav`, Publiceringsoversigt
    (`artikler/page.tsx`) — faner, søgning, filtre, grupperede sektioner BREAKING/FASTGJORT/ALLE,
    `.table` med status prik + indholdstype-badge + handlinger.
15. **Artikel-editor** (`artikler/[id]/page.tsx` + `artikler/ny/`): blokeditor-komponent +
    højre sidepanel (kategori, tags, forfatter, indholdstype/mærkning, AI-brug, SEO).
    Publish = server action der tjekker `can(user,'article.publish')` + marking (AC-01).
16. **Offentligt læse-API:** `app/api/articles/route.ts` + `[slug]/route.ts` — kun `status==='Publiceret'`.
17. **README.md** + login-side (`app/(admin)/login/` eller egen).

---

## 3. ⚠️ Next.js 16 — LÆS DETTE (breaking changes vs. Next 14/15)

Repoets `AGENTS.md` kræver at man læser `node_modules/next/dist/docs/`. Vigtigste:

1. **`middleware.ts` → `proxy.ts`.** Middleware er omdøbt til Proxy. Fil = `proxy.ts` i rod,
   eksportér `proxy` (named) el. default. Bruges til optimistic auth-redirect (IKKE fuld auth —
   det sker i server actions/layout). Matcher: `config = { matcher: ['/((?!api|_next|login).*)'] }`.
2. **Alle request-API'er er async** (synk adgang helt fjernet i 16): `params`, `searchParams`,
   `cookies()`, `headers()`, `draftMode()` — **altid `await`**.
   - Page: `export default async function Page(props: PageProps<'/artikler/[id]'>) { const { id } = await props.params }`
   - Route handler: `export async function GET(req, ctx: RouteContext<'/api/articles/[slug]'>) { const { slug } = await ctx.params }`
   - Kør `npx next typegen` for at få `PageProps`/`LayoutProps`/`RouteContext` helpers.
3. Turbopack er default (fint; `--webpack` hvis problemer).
4. `revalidateTag` kræver nu 2 arg (`revalidateTag('x','max')`). Brug hellere `revalidatePath`.
5. React 19.2 (View Transitions, useEffectEvent).

## 4. ⚠️ Andre versionsfaldgruber

- **Prisma er sat til v6** (`prisma` + `@prisma/client` ^6.19) — IKKE v7. V7 havde en breaking change
  (datasource `url` flytter til `prisma.config.ts` + driver-adapter på PrismaClient). V6 virker med
  klassisk `url = env("DATABASE_URL")` i schemaet og er bekræftet gyldigt (`npx prisma validate` ✅).
  Bliv på v6 medmindre der er grund til at opgradere. Kør `prisma generate` / `prisma db push`.
- **Zod v4** — basis-API (`z.object`, `z.string()`, `.parse`) uændret, men fejl-customization ændret.
- **next-auth beta.32** — brug JWT-strategy med credentials (database-sessions + credentials
  adapter virker ikke sammen). Session udvides med `roleId`/`instansId`/permissions via callbacks.
- **Auth.js v5 + Next 16 proxy:** standardmønsteret `export default auth` (hvor `auth = NextAuth(cfg)`)
  virker som proxy-handler — signaturen er kompatibel. Men proxy må ikke lave tung session-lookup;
  tjek kun om auth-cookie findes, lad layout/server action lave den reelle auth.

---

## 5. Kør det (når libs er bygget)

```bash
cd /Users/Lysdal/GITS/Local2027/cms
npm install              # kører prisma generate via postinstall
npx prisma db push       # opretter SQLite-DB + client  (eller: npm run db:push)
npm run seed             # Slagelse-instans + roller + testbrugere
npm run dev              # http://localhost:3000
```

**Testbrugere (når seed er bygget — vælg passwords i seed.ts, fx `redaktør`/`journalist`):**
- redaktoer@slagelse.test — kan publicere (article.publish)
- journalist@slagelse.test — kan IKKE publicere

## 6. Verifikation (acceptkriterier der SKAL virke før leverance)

- **AC-01:** Sponsoreret artikel uden marking → publicering **blokeres** med tydelig fejl (`.dialog`/`.error-text`). Med marking → OK.
- **Godkendelseskæde:** journalist kan ikke publicere (knap deaktiveret + server afviser).
- **Læse-API:** `curl localhost:3000/api/articles` returnerer kun Publiceret; kladde ekskluderes.
- **Generisk kerne:** `grep -ri slagelse cms/lib cms/app` må kun ramme seed/README (intet hardkodet i kerne).

---

## 7. Designsystem — Modernist (kilde)

- Claude Design-projekt **"Modernist"**, `projectId: 62593e37-cfc9-4a4a-a0f7-e5fd383acd7e`.
- Læs/synk via `DesignSync`-tool (MCP): `get_file` med paths som `styles.css`, `theme.json`,
  `components/buttons.html`, `components/navigation.html`, `components/forms.html`,
  `components/table.html`, `components/cards.html`, `components/dialog.html`,
  `foundations/color.html`, `foundations/type.html`, `foundations/layout.html`.
- Visuelt sprog: Archivo · bund `#f3f2f2`/blæk `#201e1d`/accent `#ec3013` · **radius 0** ·
  2px-delere · modulær grid · alt flush-venstre · s/h-foto (`.grayscale`) · Lucide-ikoner.
- **Byg UI med klasserne** (`.btn`, `.nav`, `.table`, `.card`, `.dialog`, `.tag`, `.field`/`.input`/`.seg`),
  IKKE parallelle Tailwind-komponenter. Tailwind = kun layout-utilities.

## 8. Fil-inventar (skabt indtil videre)

```
cms/
├── app/globals.css          ✅ (Tailwind + modernist + theme-bro)
├── app/layout.tsx           ✅ (Archivo)
├── app/page.tsx             ⛔ boilerplate — erstates med redirect til /artikler
├── styles/modernist.css     ✅ vendoret
├── prisma/schema.prisma     ✅ fuld datamodel
├── .env / .env.example      ✅
├── package.json             ✅ (scripts tilføjet)
└── (alt andet mangler — se afsnit 2)
```

## 9. Noter til næste model

- Brugerens sprog er **dansk** — svar på dansk, UI-tekster på dansk.
- Bruger kører via **Z.ai GLM-5.2 backend**; effort/medium default.
- Værd at gemme som memory når fundamentet er færdigt: projektet, Modernist-kilden, Next 16 proxy-note.
- Pas på scope: fundament kun. Signals/Topics/AI-lag/mediebibliotek/supporterdashboard/frontend-site = roadmap.
