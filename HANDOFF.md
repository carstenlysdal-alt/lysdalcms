# HANDOFF — Lysdals CMS fundament

> **Status:** Fundamentet og CMS-03 mediebibliotek v1 er implementeret. Næste session kan starte på næste roadmap-modul eller visuel/manual QA.
> **Dato:** 2026-08-03. **Repo:** `/Users/Lysdal/GITS/Local2027/cms/` (Next.js 16, nystartet).

Denne fil er overleveringsloggen. Læs den FØR du bygger videre — den indeholder
alle beslutninger, Next 16-faldgruber, præcis hvad der er gjort, og de næste trin.

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

Demo-login: `redaktoer@slagelse.test` eller `journalist@slagelse.test`, adgangskode `cms-demo-2026`.

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
