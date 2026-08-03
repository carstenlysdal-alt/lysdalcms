# Lysdals CMS

Fundamentet til et generisk, AI-understøttet redaktionelt CMS. Denne leverance indeholder artikelmodel, konfigurerbar instans, credentials-login, databasebaseret RBAC, redaktionelt workflow, blokeditor, publiceringsoversigt og et offentligt læse-API.

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

## Arkitektur

- Next.js 16 App Router, React 19 og TypeScript
- Prisma 6 med SQLite i udvikling; schemaet holder instansspecifikke værdier som data
- Auth.js v5 credentials + JWT-session
- Zod-validerede strukturerede artikelblokke
- Modernist-designsystem med Archivo, firkantede flader og designsystemets komponentklasser

Den aktuelle afgrænsning er CMS-fundamentet. Mediebibliotek/pipeline, opgave- og honorarmodul, indsendelser, kalender, Signals/Topics, AI-lag, supporterdashboard og offentlig frontend er roadmap.
