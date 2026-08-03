# Lysdals CMS

Et generisk, AI-understøttet redaktionelt CMS. Den aktuelle leverance indeholder artikelmodel, konfigurerbar instans, credentials-login, databasebaseret RBAC, redaktionelt workflow, blokeditor, publiceringsoversigt, mediebibliotek, opgave-/honorarstyring og et offentligt læse-API.

## Lokal opsætning

Krav: Node.js 20+ og npm.

```bash
npm install
cp .env.example .env
npm run db:push
npm run seed
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000). SQLite-filen oprettes som `prisma/dev.db`.

Demo-brugere (samme adgangskode: `cms-demo-2026`):

- `redaktoer@slagelse.test` — fuld redaktionel adgang og publiceringsret
- `journalist@slagelse.test` — kan oprette og redigere egne artikler, men ikke publicere

Skift demo-adgangskoder og `AUTH_SECRET` før enhver delt eller produktionslignende installation.

## Scripts

```bash
npm run dev        # udviklingsserver
npm run build      # produktionsbuild + typekontrol
npm run lint       # ESLint
npm test           # governance-, blok- og medietests
npm run db:push    # synkronisér Prisma-schema til dev-databasen
npm run seed       # idempotent referenceinstans og demo-data
npm run db:studio  # Prisma Studio
```

## Publiceringsregler

Reglerne håndhæves i server actions, også hvis UI'et omgås:

- Kun brugere med `article.publish` kan gå fra `Godkendelse` eller `Planlagt` til `Publiceret`.
- `Partner` og `Sponsoreret` kan ikke publiceres uden sponsor/partner og synlig mærkning (AC-01).
- AI-brug skal være registreret ved publicering.
- En publicering opretter en `ArticleRevision` med snapshot og ansvarlig bruger.

Seedet indeholder en sponsoreret artikel i `Godkendelse` uden mærkning, så AC-01 kan afprøves direkte.

## Offentligt API

- `GET /api/articles?limit=20`
- `GET /api/articles/:slug`

Begge endpoints returnerer udelukkende artikler med status `Publiceret`. Udkast, godkendelsesartikler og arkiveret indhold eksponeres ikke.

## Mediebibliotek

`/medier` er det centrale bibliotek for billeder, video, lyd og dokumenter:

- Lokal upload op til 10 MB eller registrering af en ekstern URL.
- JPG, PNG og WebP orienteres, skaleres til maksimalt 2400×2400 og gemmes som WebP.
- Billeder kræver alt-tekst og billedtekst.
- Ophavsperson, licens, rettighedsstatus og eventuel udløbsdato registreres som metadata.
- Billeder kan genbruges som artikelcover og i editorens billedblokke.

Lokal upload gemmes under `public/uploads` og er en udviklingsadapter. Produktionsdrift bør koble samme mediemodel til S3/R2 eller tilsvarende persistent objektlager; uploadede filer er derfor ikke versionsstyret.

## Opgaver og honorarer

`/opgaver` understøtter den redaktionelle kæde fra brief til godkendt leverance:

- Direkte tildeling eller åben opgavepulje.
- Research- og afleveringsdeadline med tydelig 48-timers-/overskredet markering.
- Konfigurerbar leverancetype og vejledende honorarinterval pr. instans.
- Kobling til artikel og valgfri støtteaftale.
- Obligatorisk interessekonflikterklæring ved aflevering.
- Journalistens eget opgave-/honorarview og ledelsens samlede overblik.

Ved første publicering af en koblet freelanceopgave godkendes opgaven og oprettes en unik honorarpost i samme databasetransaktion. `/honorar` håndterer godkendelse, og `GET /api/honorar/export` leverer semikolonsepareret UTF-8 CSV til bogføring.

## Arkitektur

- Next.js 16 App Router, React 19 og TypeScript
- Prisma 6 med SQLite i udvikling; schemaet holder instansspecifikke værdier som data
- Auth.js v5 credentials + JWT-session
- Zod-validerede strukturerede artikelblokke
- Modernist-designsystem med Archivo, firkantede flader og designsystemets komponentklasser

Den aktuelle afgrænsning er CMS-fundamentet plus CMS-03 og CMS-06 v1. E-mail/push-påmindelser, indsendelser, kalender, Signals/Topics, AI-lag, supporterdashboard, produktions-storage og offentlig frontend er roadmap.
