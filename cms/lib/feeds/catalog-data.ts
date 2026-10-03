/* GENERERET af scripts/gen-feed-catalog.ts fra docs/localrating/source-registries. Redigér ikke i hånden. */
import type { CatalogPack } from "./catalog";

export const CATALOG_PACKS: readonly CatalogPack[] = [
  {
    "id": "slagelse",
    "navn": "Slagelse, Korsør og Skælskør",
    "rows": [
      {
        "pri": 0,
        "kilde": "Politi Update – Sydsjællands og Lolland-Falsters Politi",
        "omraade": "Politi",
        "adgang": "RSS; medie-API kan søges",
        "filter": null,
        "brug": "Akutte hændelser, trafik, efterlysninger"
      },
      {
        "pri": 0,
        "kilde": "Politiets døgnrapporter og nyheder",
        "omraade": "Politi",
        "adgang": "Web/feed-monitor",
        "filter": null,
        "brug": "Kriminalitet, kontroller, opfølgning"
      },
      {
        "pri": 0,
        "kilde": "Slagelse Brand & Redning",
        "omraade": "Beredskab",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Brande, redning, øvelser"
      },
      {
        "pri": 0,
        "kilde": "DMI Open Data",
        "omraade": "Vejr",
        "adgang": "API",
        "filter": null,
        "brug": "Varsler, vind, lyn, hav/vandstand"
      },
      {
        "pri": 0,
        "kilde": "Storebælt / Sund & Bælt trafikstatus",
        "omraade": "Trafik",
        "adgang": "Status-side, mail/SMS, monitor",
        "filter": null,
        "brug": "Vindrestriktioner, lukninger, kø"
      },
      {
        "pri": 0,
        "kilde": "Vejdirektoratet Trafikinfo",
        "omraade": "Trafik",
        "adgang": "Web/open-data hvor tilbudt",
        "filter": null,
        "brug": "Uheld, kø, vejarbejde"
      },
      {
        "pri": 0,
        "kilde": "DSB trafikinformation",
        "omraade": "Jernbane",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Forsinkelser og aflysninger"
      },
      {
        "pri": 0,
        "kilde": "Banedanmark",
        "omraade": "Jernbane",
        "adgang": "Web/nyheder/projekter",
        "filter": null,
        "brug": "Sporarbejde og projekter"
      },
      {
        "pri": 0,
        "kilde": "Rejseplanen Labs / GTFS / SIRI",
        "omraade": "Kollektiv trafik",
        "adgang": "API/GTFS; licensvilkår",
        "filter": null,
        "brug": "Realtid, ruter, aflysninger"
      },
      {
        "pri": 0,
        "kilde": "Cerius driftsinfo",
        "omraade": "El",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Strømafbrydelser"
      },
      {
        "pri": 0,
        "kilde": "Envafors",
        "omraade": "Forsyning",
        "adgang": "Web/nyheder/driftsinfo",
        "filter": null,
        "brug": "Vand, varme og driftsforstyrrelser"
      },
      {
        "pri": 0,
        "kilde": "AffaldPlus",
        "omraade": "Affald",
        "adgang": "Web/nyheder/SMS",
        "filter": null,
        "brug": "Affaldsdrift og genbrugspladser"
      },
      {
        "pri": 0,
        "kilde": "Agersø-Omø Færgerne / Stigsnæs",
        "omraade": "Færger",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Aflysninger og drift"
      },
      {
        "pri": 0,
        "kilde": "Region Sjælland / Slagelse Sygehus",
        "omraade": "Sundhed",
        "adgang": "Web/nyheder",
        "filter": null,
        "brug": "Drift, projekter og sundhedsnyheder"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Kommune – nyheder og presse",
        "omraade": "Kommune",
        "adgang": "Web/change monitor",
        "filter": null,
        "brug": "Kommunale nyheder og projekter"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Kommune – dagsordener/referater",
        "omraade": "Kommunalpolitik",
        "adgang": "Mail + web-monitor",
        "filter": null,
        "brug": "Sager før og efter beslutning"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Kommune – høringer",
        "omraade": "Plan/politik",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Høringer, frister og indsigelser"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Kommune – lokalplaner/kommuneplan",
        "omraade": "Plan",
        "adgang": "Web + Plandata",
        "filter": null,
        "brug": "Byudvikling og byggeri"
      },
      {
        "pri": 1,
        "kilde": "Plandata.dk",
        "omraade": "Plan/open data",
        "adgang": "REST/WFS/WMS",
        "filter": null,
        "brug": "Lokalplaner og kommuneplanrammer"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Kommune – udbud/markedsdialog",
        "omraade": "Udbud",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Kommende indkøb og kontrakter"
      },
      {
        "pri": 1,
        "kilde": "udbud.dk",
        "omraade": "Udbud",
        "adgang": "Search/monitor",
        "filter": null,
        "brug": "Udbud, kontrakter, værdier"
      },
      {
        "pri": 1,
        "kilde": "TED",
        "omraade": "EU-udbud",
        "adgang": "EU-data/feed",
        "filter": null,
        "brug": "Store udbud og tildelinger"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Kommune – budget/regnskab",
        "omraade": "Økonomi",
        "adgang": "Web/PDF-monitor",
        "filter": null,
        "brug": "Budgetter, merforbrug, besparelser"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Kommune – indkøbs-/leverandørdata",
        "omraade": "Økonomi",
        "adgang": "Web/download",
        "filter": null,
        "brug": "Største leverandører og indkøb"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Kommune – jobs",
        "omraade": "Arbejde",
        "adgang": "Web/jobfeed",
        "filter": null,
        "brug": "Rekruttering og ledelsesændringer"
      },
      {
        "pri": 1,
        "kilde": "Folketingets åbne data",
        "omraade": "National politik",
        "adgang": "OData JSON/ATOM",
        "filter": null,
        "brug": "Spørgsmål, bilag, udvalg, debatter"
      },
      {
        "pri": 1,
        "kilde": "Retsinformation",
        "omraade": "Lovgivning",
        "adgang": "REST + ELI Atom/sitemap",
        "filter": null,
        "brug": "Nye og ændrede regler"
      },
      {
        "pri": 1,
        "kilde": "Statstidende",
        "omraade": "Jura/virksomhed",
        "adgang": "OpenAPI",
        "filter": null,
        "brug": "Konkurser, tvangsauktioner, proklama"
      },
      {
        "pri": 1,
        "kilde": "Retten i Næstved – retslister",
        "omraade": "Domstole",
        "adgang": "Web/PDF-monitor",
        "filter": null,
        "brug": "Lokale straffe-, civil- og auktionssager"
      },
      {
        "pri": 1,
        "kilde": "Ankestyrelsen",
        "omraade": "Tilsyn/klager",
        "adgang": "Afgørelsesmonitor",
        "filter": null,
        "brug": "Kommunale tilsynssager"
      },
      {
        "pri": 1,
        "kilde": "Planklagenævnet",
        "omraade": "Klage/plan",
        "adgang": "Afgørelsesdatabase",
        "filter": null,
        "brug": "Plan- og byggesager"
      },
      {
        "pri": 1,
        "kilde": "Miljø- og Fødevareklagenævnet",
        "omraade": "Klage/miljø",
        "adgang": "Afgørelsesdatabase",
        "filter": null,
        "brug": "Miljø- og natursager"
      },
      {
        "pri": 1,
        "kilde": "Folketingets Ombudsmand",
        "omraade": "Tilsyn",
        "adgang": "Afgørelser/nyheder",
        "filter": null,
        "brug": "Principielle myndighedssager"
      },
      {
        "pri": 1,
        "kilde": "Datatilsynet",
        "omraade": "Tilsyn",
        "adgang": "Afgørelser/nyheder",
        "filter": null,
        "brug": "GDPR, brud og lokale myndigheder"
      },
      {
        "pri": 1,
        "kilde": "Erhvervsstyrelsen / CVR",
        "omraade": "Virksomheder",
        "adgang": "Officiel API",
        "filter": null,
        "brug": "Nye virksomheder, status og ledelse"
      },
      {
        "pri": 1,
        "kilde": "Danmarks Statistik / StatBank",
        "omraade": "Statistik",
        "adgang": "API",
        "filter": null,
        "brug": "Befolkning, bolig, erhverv, demografi"
      },
      {
        "pri": 1,
        "kilde": "Jobindsats API v3",
        "omraade": "Arbejdsmarked",
        "adgang": "API JSON/CSV",
        "filter": null,
        "brug": "Ledighed og beskæftigelse"
      },
      {
        "pri": 1,
        "kilde": "Dataforsyningen / Grunddata",
        "omraade": "Geodata",
        "adgang": "API",
        "filter": null,
        "brug": "Adresser, steder, matrikler, områder"
      },
      {
        "pri": 1,
        "kilde": "GEUS Jupiter",
        "omraade": "Miljø/vand",
        "adgang": "WFS/WMS/download/webservices",
        "filter": null,
        "brug": "Grundvand, drikkevand og boringer"
      },
      {
        "pri": 1,
        "kilde": "Danmarks Miljøportal / DMA",
        "omraade": "Miljø",
        "adgang": "Web/data services",
        "filter": null,
        "brug": "Miljøgodkendelser og tilsyn"
      },
      {
        "pri": 1,
        "kilde": "Kystdirektoratet",
        "omraade": "Kyst/klima",
        "adgang": "Web/data",
        "filter": null,
        "brug": "Diger, højvand og kystbeskyttelse"
      },
      {
        "pri": 1,
        "kilde": "Forsvaret / Gardehusarregimentet",
        "omraade": "Forsvar",
        "adgang": "Web/nyheder",
        "filter": null,
        "brug": "Kaserne, øvelser, værnepligt"
      },
      {
        "pri": 1,
        "kilde": "Korsør Havn",
        "omraade": "Havn/erhverv",
        "adgang": "Web/nyheder",
        "filter": null,
        "brug": "Gods, investeringer og havnedrift"
      },
      {
        "pri": 1,
        "kilde": "Skælskør Havn",
        "omraade": "Havn",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Havnedrift og aktiviteter"
      },
      {
        "pri": 1,
        "kilde": "Storebælt / Sund & Bælt – nyheder/trafiktal",
        "omraade": "Infrastruktur",
        "adgang": "Web/download",
        "filter": null,
        "brug": "Broprojekter, vedligehold og trafik"
      },
      {
        "pri": 1,
        "kilde": "Slagelse Erhverv",
        "omraade": "Erhverv",
        "adgang": "Nyheder/nyhedsbrev",
        "filter": null,
        "brug": "Lokale virksomheder og investeringer"
      },
      {
        "pri": 1,
        "kilde": "DI Vestsjælland",
        "omraade": "Erhverv",
        "adgang": "Nyheder/Via Ritzau",
        "filter": null,
        "brug": "Erhvervspolitik og lokale virksomheder"
      },
      {
        "pri": 1,
        "kilde": "Via Ritzau",
        "omraade": "Pressemeddelelser",
        "adgang": "Public newsroom/search/RSS hvor muligt",
        "filter": null,
        "brug": "Myndigheder, virksomheder og fonde"
      },
      {
        "pri": 1,
        "kilde": "Ritzau nyhedstjeneste",
        "omraade": "Newswire",
        "adgang": "Licenseret feed/API",
        "filter": null,
        "brug": "Bred nyhedsstrøm; kræver aftale"
      },
      {
        "pri": 2,
        "kilde": "TV2 ØST",
        "omraade": "Regionalt medie",
        "adgang": "Web/RSS hvis tilbudt",
        "filter": null,
        "brug": "Discovery og krydstjek"
      },
      {
        "pri": 2,
        "kilde": "Sjællandske Nyheder / sn.dk",
        "omraade": "Lokalt medie",
        "adgang": "Web/RSS hvis tilbudt",
        "filter": null,
        "brug": "Lokale historier og konkurrentovervågning"
      },
      {
        "pri": 2,
        "kilde": "DR P4 Sjælland",
        "omraade": "Regionalt medie",
        "adgang": "Web/app/feed hvor lovligt",
        "filter": null,
        "brug": "Discovery og breaking"
      },
      {
        "pri": 2,
        "kilde": "DK Nyt",
        "omraade": "Kommunalmedie",
        "adgang": "Web/nyhedsbrev",
        "filter": null,
        "brug": "Kommunale historier"
      },
      {
        "pri": 2,
        "kilde": "112news.dk",
        "omraade": "Lokalt nichemedie",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Politi, brand og ulykker"
      },
      {
        "pri": 2,
        "kilde": "Slagelse.info / Slagelse.News / Korsor.News / Skaelskor.News",
        "omraade": "Lokalt medie",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Lokale historier og events"
      },
      {
        "pri": 2,
        "kilde": "SlagelseJournalen",
        "omraade": "Lokalt medie",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Lokalt discovery"
      },
      {
        "pri": 2,
        "kilde": "VORES-lokalsider",
        "omraade": "Aggregator",
        "adgang": "Web-monitor",
        "filter": null,
        "brug": "Events, bolig og lokale signaler"
      },
      {
        "pri": 2,
        "kilde": "SlagelsePortal",
        "omraade": "Lokal portal",
        "adgang": "Seed/monitor",
        "filter": null,
        "brug": "Lokale links og discovery"
      },
      {
        "pri": 2,
        "kilde": "Slagelse Bibliotekerne – arrangementer",
        "omraade": "Kultur/events",
        "adgang": "Struktureret web-monitor",
        "filter": null,
        "brug": "Arrangementer i alle tre byer"
      },
      {
        "pri": 2,
        "kilde": "Slagelse Kommune – foreningsoversigt (Winkas)",
        "omraade": "Foreninger",
        "adgang": "Seed directory",
        "filter": null,
        "brug": "Opdag 300+ foreninger og deres websites"
      },
      {
        "pri": 2,
        "kilde": "Slagelse Kommune – lokalrådsoversigt",
        "omraade": "Lokalsamfund",
        "adgang": "Seed directory",
        "filter": null,
        "brug": "Lokale initiativer og møder"
      },
      {
        "pri": 2,
        "kilde": "Kommunale folkeskoler",
        "omraade": "Skole",
        "adgang": "Seed + website-monitor",
        "filter": null,
        "brug": "Skoleevents, ledelse, projekter"
      },
      {
        "pri": 2,
        "kilde": "Privat- og friskoler",
        "omraade": "Skole",
        "adgang": "Seed + website-monitor",
        "filter": null,
        "brug": "Lokale skolehistorier"
      },
      {
        "pri": 2,
        "kilde": "Dagtilbud/private dagtilbud",
        "omraade": "Dagtilbud",
        "adgang": "Seed + selective monitor",
        "filter": null,
        "brug": "Kapacitet, åbning/lukning, events"
      },
      {
        "pri": 2,
        "kilde": "Professionshøjskolen Absalon – Campus Slagelse",
        "omraade": "Uddannelse",
        "adgang": "Web/nyheder/events",
        "filter": null,
        "brug": "Uddannelse og studieliv"
      },
      {
        "pri": 2,
        "kilde": "ZBC Slagelse",
        "omraade": "Uddannelse",
        "adgang": "Web/nyheder/events",
        "filter": null,
        "brug": "Erhvervsuddannelse og arbejdsmarked"
      },
      {
        "pri": 2,
        "kilde": "Slagelse Gymnasium",
        "omraade": "Uddannelse",
        "adgang": "Web/nyheder/events",
        "filter": null,
        "brug": "Ungdom og uddannelse"
      },
      {
        "pri": 2,
        "kilde": "Lokale kirker/sogne",
        "omraade": "Lokalsamfund",
        "adgang": "sogn.dk + officielle sider",
        "filter": null,
        "brug": "Events, udnævnelser og fællesskab"
      },
      {
        "pri": 2,
        "kilde": "Lokale idrætsforeninger",
        "omraade": "Sport",
        "adgang": "Winkas seed + klubwebsites",
        "filter": null,
        "brug": "Kampe, resultater og faciliteter"
      },
      {
        "pri": 2,
        "kilde": "Lokale kulturinstitutioner/spillesteder/teatre/biografer",
        "omraade": "Kultur",
        "adgang": "Seed + event-monitor",
        "filter": null,
        "brug": "Program, events og bevillinger"
      },
      {
        "pri": 2,
        "kilde": "Museum Vestsjælland / Trelleborg m.fl.",
        "omraade": "Kultur/historie",
        "adgang": "Web/nyheder/events",
        "filter": null,
        "brug": "Arkæologi, kulturarv og events"
      },
      {
        "pri": 2,
        "kilde": "Lokale virksomheders egne newsrooms",
        "omraade": "Virksomheder",
        "adgang": "CVR seed + website-monitor",
        "filter": null,
        "brug": "Investeringer, fyringer, udvidelser"
      },
      {
        "pri": 2,
        "kilde": "Officielle lokale sociale konti",
        "omraade": "Social signal",
        "adgang": "Officiel API/alerts/manual",
        "filter": null,
        "brug": "Tidlige signaler; altid verificér"
      },
      {
        "pri": 2,
        "kilde": "Mynewsdesk og andre PR-platforme",
        "omraade": "PR",
        "adgang": "Search/feed hvor tilladt",
        "filter": null,
        "brug": "Lokale pressemeddelelser"
      }
    ]
  },
  {
    "id": "naestved",
    "navn": "Næstved og lokale bysamfund",
    "rows": [
      {
        "pri": 0,
        "kilde": "Politi Update – Sydsjællands og Lolland-Falsters Politi",
        "omraade": "Politi",
        "adgang": "RSS; medie-API kan søges",
        "filter": "Næstved + kommunens stedaliaser",
        "brug": "Akutte hændelser, trafik, efterlysninger"
      },
      {
        "pri": 0,
        "kilde": "Sydsjællands og Lolland-Falsters Politi – døgnrapporter/nyheder",
        "omraade": "Politi",
        "adgang": "Web/feed-monitor",
        "filter": "Næstved, Glumsø, Herlufmagle m.fl.",
        "brug": "Kriminalitet, kontroller, hændelser, opfølgning"
      },
      {
        "pri": 0,
        "kilde": "Midt- og Sydsjællands Brand & Redning",
        "omraade": "Beredskab",
        "adgang": "Web + officielle sociale signaler/change monitor",
        "filter": "Næstved Kommune",
        "brug": "Brande, redning, beredskab, stationer, øvelser"
      },
      {
        "pri": 0,
        "kilde": "DMI Open Data",
        "omraade": "Vejr/beredskab",
        "adgang": "API",
        "filter": "Koordinater/bounding box",
        "brug": "Varsler, storm, skybrud, vind, vandstand, lyn"
      },
      {
        "pri": 0,
        "kilde": "Vejdirektoratet Trafikinfo",
        "omraade": "Trafik",
        "adgang": "Web/open data hvor tilbudt",
        "filter": "E47/E55/Rute 54/kommunens vejnet",
        "brug": "Uheld, kø, vejarbejde, planlagte hændelser"
      },
      {
        "pri": 0,
        "kilde": "Vejdirektoratet – Næstved-Rønnede motorvejsprojekt",
        "omraade": "Infrastruktur",
        "adgang": "Projekt-/nyhedssider",
        "filter": "Næstved–Rønnede korridoren",
        "brug": "Anlægslov, ekspropriation, tidsplan, entrepriser"
      },
      {
        "pri": 0,
        "kilde": "DSB trafikinformation",
        "omraade": "Jernbane",
        "adgang": "Web/change monitor",
        "filter": "Næstved station + lokale stationer",
        "brug": "Forsinkelser, aflysninger, sporarbejde"
      },
      {
        "pri": 0,
        "kilde": "Banedanmark",
        "omraade": "Jernbane",
        "adgang": "Web/nyheder/projekter",
        "filter": "Næstved og banekorridorer",
        "brug": "Sporarbejde, elektrificering, projekter"
      },
      {
        "pri": 0,
        "kilde": "Movia",
        "omraade": "Bus",
        "adgang": "Trafikinfo/API hvor tilbudt",
        "filter": "Buslinjer i Næstved Kommune",
        "brug": "Driftsændringer, omlægninger, aflysninger"
      },
      {
        "pri": 0,
        "kilde": "Rejseplanen Labs / GTFS / SIRI",
        "omraade": "Kollektiv trafik",
        "adgang": "API/GTFS; gældende vilkår",
        "filter": "Stop/stationer i kommunen",
        "brug": "Realtid, aflysninger, ruter, køreplaner"
      },
      {
        "pri": 0,
        "kilde": "NK-Forsyning / NK-Vand / NK-Spildevand",
        "omraade": "Forsyning",
        "adgang": "Web/driftsinfo/change monitor",
        "filter": "Næstved Kommune",
        "brug": "Vand, spildevand, driftsforstyrrelser, anlæg"
      },
      {
        "pri": 0,
        "kilde": "Envafors – overgangsrelevante Næstved-sider",
        "omraade": "Forsyning",
        "adgang": "Web/driftsinfo",
        "filter": "Næstved/NK-Forsyning under udtræden",
        "brug": "Overgang, drift, kundemeddelelser"
      },
      {
        "pri": 0,
        "kilde": "Næstved Fjernvarme",
        "omraade": "Fjernvarme",
        "adgang": "Web/driftsstatus/change monitor",
        "filter": "Næstved by",
        "brug": "Varmeudfald, udbygning, priser, projekter"
      },
      {
        "pri": 0,
        "kilde": "Fensmark Fjernvarme",
        "omraade": "Fjernvarme",
        "adgang": "Web/change monitor",
        "filter": "Fensmark",
        "brug": "Drift, takster, udbygning"
      },
      {
        "pri": 0,
        "kilde": "Fuglebjerg Fjernvarme",
        "omraade": "Fjernvarme",
        "adgang": "Web/change monitor",
        "filter": "Fuglebjerg",
        "brug": "Drift, takster, udbygning"
      },
      {
        "pri": 0,
        "kilde": "Sandved-Tornemark Kraftvarmeværker",
        "omraade": "Fjernvarme",
        "adgang": "Web/change monitor",
        "filter": "Sandved/Tornemark",
        "brug": "Drift, takster, lokale energisager"
      },
      {
        "pri": 0,
        "kilde": "AffaldPlus",
        "omraade": "Affald",
        "adgang": "Web/nyheder/SMS/driftsinfo",
        "filter": "Næstved, Fuglebjerg, Herlufmagle, Holme-Olstrup, Mogenstrup",
        "brug": "Genbrugspladser, affaldsdrift, anlæg"
      },
      {
        "pri": 0,
        "kilde": "Region Sjælland – Næstved Sygehus",
        "omraade": "Sundhed",
        "adgang": "Web/nyheder/driftsinfo",
        "filter": "Næstved",
        "brug": "Sygehusdrift, projekter, kapacitet, sundhedsnyheder"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – nyheder og pressemeddelelser",
        "omraade": "Kommune",
        "adgang": "Web/change monitor/abonnement",
        "filter": "Kommune 370",
        "brug": "Kommunale beslutninger, service, projekter"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – dagsordener og referater",
        "omraade": "Kommunalpolitik",
        "adgang": "Dagsordensportal/search/PDF-monitor",
        "filter": "Alle udvalg/byråd",
        "brug": "Sager før og efter politiske beslutninger"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – høringer og borgermøder",
        "omraade": "Plan/politik",
        "adgang": "Struktureret web/change monitor",
        "filter": "Adresse/sted/topic",
        "brug": "Nye høringer, landzone, veje, miljø, planer"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – lokalplanportal",
        "omraade": "Plan",
        "adgang": "Struktureret portal/map/search",
        "filter": "Adresse/matrikel/sted",
        "brug": "Gældende planer, nye forslag, planer i høring"
      },
      {
        "pri": 1,
        "kilde": "Plandata.dk",
        "omraade": "Plan/open data",
        "adgang": "REST/WFS/WMS",
        "filter": "Kommunekode 370 + geometri",
        "brug": "Lokalplaner, kommuneplanrammer, statusændringer"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – kommuneplan/strategi",
        "omraade": "Plan/politik",
        "adgang": "Web/PDF monitor",
        "filter": "Kommune 370",
        "brug": "Langsigtet byudvikling, arealer, erhverv, natur"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – udbud og indkøb",
        "omraade": "Udbud",
        "adgang": "Web/change monitor",
        "filter": "Næstved Kommune",
        "brug": "Aktuelle udbud, leverandører, kontrakter"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – udbudsplan",
        "omraade": "Udbud",
        "adgang": "Web/PDF monitor",
        "filter": "Næstved Kommune",
        "brug": "Kommende indkøb før udbuddet rammer markedet"
      },
      {
        "pri": 1,
        "kilde": "FUS – Fællesudbud Sjælland",
        "omraade": "Udbud",
        "adgang": "Web/udbudsmonitor",
        "filter": "Næstved som deltager/ordregiver",
        "brug": "Fælleskommunale indkøb og tildelinger"
      },
      {
        "pri": 1,
        "kilde": "udbud.dk",
        "omraade": "Udbud",
        "adgang": "Search/monitor",
        "filter": "Ordregiver=Næstved Kommune/lokale aktører",
        "brug": "Udbud, kontrakter, værdier, frister"
      },
      {
        "pri": 1,
        "kilde": "TED – Tenders Electronic Daily",
        "omraade": "EU-udbud",
        "adgang": "EU-data/feed/API",
        "filter": "Næstved/lokale ordregivere",
        "brug": "Store EU-udbud og tildelinger"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – budget, regnskab og økonomi",
        "omraade": "Økonomi",
        "adgang": "Web/PDF monitor",
        "filter": "Kommune 370",
        "brug": "Budgetter, besparelser, merforbrug, regnskab"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – projekter",
        "omraade": "Byudvikling",
        "adgang": "Projektpages/change monitor",
        "filter": "Havnebydel, bymidte, større projekter",
        "brug": "Projektmilepæle, beslutninger, events, anlæg"
      },
      {
        "pri": 1,
        "kilde": "Næstved Kommune – jobs",
        "omraade": "Arbejde",
        "adgang": "Jobsite/feed/monitor",
        "filter": "Næstved Kommune",
        "brug": "Ledelsesændringer, rekruttering, kapacitet"
      },
      {
        "pri": 1,
        "kilde": "Folketingets åbne data",
        "omraade": "National politik",
        "adgang": "OData API JSON/ATOM",
        "filter": "Næstved + entities + lokale projekter",
        "brug": "Spørgsmål, udvalg, lovforslag, bilag, debatter"
      },
      {
        "pri": 1,
        "kilde": "Retsinformation",
        "omraade": "Lovgivning",
        "adgang": "REST harvest API + ELI Atom/sitemap",
        "filter": "Geo/entity/kommune-filter",
        "brug": "Nye/ændrede regler med lokal konsekvens"
      },
      {
        "pri": 1,
        "kilde": "Statstidende",
        "omraade": "Jura/virksomheder",
        "adgang": "OpenAPI",
        "filter": "Postnr./CVR/adresse/navn",
        "brug": "Konkurser, tvangsauktioner, proklama, juridiske meddelelser"
      },
      {
        "pri": 1,
        "kilde": "Retten i Næstved – retslister",
        "omraade": "Domstole",
        "adgang": "HTML/PDF monitor",
        "filter": "Næstved Kommune + lokale personer/virksomheder",
        "brug": "Straffe-, civil-, skifte- og auktionssager"
      },
      {
        "pri": 1,
        "kilde": "Ankestyrelsen",
        "omraade": "Tilsyn/klager",
        "adgang": "Web/afgørelser/search",
        "filter": "Næstved Kommune/entity",
        "brug": "Kommunale tilsyns- og klagesager"
      },
      {
        "pri": 1,
        "kilde": "Planklagenævnet",
        "omraade": "Klage/plan",
        "adgang": "Afgørelsesdatabase/search",
        "filter": "Næstved Kommune/steder",
        "brug": "Plan- og byggesager"
      },
      {
        "pri": 1,
        "kilde": "Miljø- og Fødevareklagenævnet",
        "omraade": "Klage/miljø",
        "adgang": "Afgørelsesdatabase/search",
        "filter": "Næstved Kommune/steder",
        "brug": "Miljø, natur, landbrug, virksomheder"
      },
      {
        "pri": 1,
        "kilde": "Folketingets Ombudsmand",
        "omraade": "Tilsyn",
        "adgang": "Web/afgørelser",
        "filter": "Næstved Kommune/institutioner",
        "brug": "Principielle myndighedssager"
      },
      {
        "pri": 1,
        "kilde": "Datatilsynet",
        "omraade": "Tilsyn",
        "adgang": "Web/afgørelser/nyheder",
        "filter": "Næstved Kommune/lokale aktører",
        "brug": "Datasikkerhed, GDPR, brud"
      },
      {
        "pri": 1,
        "kilde": "Arbejdstilsynet",
        "omraade": "Arbejdsmiljø",
        "adgang": "Tilsyn/nyheder/open data hvor tilbudt",
        "filter": "Lokale arbejdspladser/CVR",
        "brug": "Arbejdsulykker, påbud, arbejdsmiljø"
      },
      {
        "pri": 1,
        "kilde": "Fødevarestyrelsen / Find Smiley",
        "omraade": "Fødevarer",
        "adgang": "Offentlig database/search",
        "filter": "Adresse/CVR/postnr.",
        "brug": "Restaurantkontrol, sanktioner, fødevaresikkerhed"
      },
      {
        "pri": 1,
        "kilde": "Styrelsen for Patientsikkerhed",
        "omraade": "Sundhedstilsyn",
        "adgang": "Tilsynsrapporter/nyheder",
        "filter": "Lokale klinikker/pleje/institutioner",
        "brug": "Tilsyn, påbud, patientsikkerhed"
      },
      {
        "pri": 1,
        "kilde": "Erhvervsstyrelsen / CVR",
        "omraade": "Virksomheder",
        "adgang": "Officiel CVR-adgang/API",
        "filter": "Kommune 370/adresse/postnr./CVR",
        "brug": "Nye virksomheder, ledelsesændringer, status, branche"
      },
      {
        "pri": 1,
        "kilde": "Danmarks Statistik / StatBank",
        "omraade": "Statistik",
        "adgang": "API",
        "filter": "Kommune 370",
        "brug": "Befolkning, bolig, erhverv, kriminalitet, demografi"
      },
      {
        "pri": 1,
        "kilde": "Jobindsats API v3",
        "omraade": "Arbejdsmarked",
        "adgang": "API JSON/CSV",
        "filter": "Kommune=Næstved",
        "brug": "Ledighed, ydelser, beskæftigelse"
      },
      {
        "pri": 1,
        "kilde": "Dataforsyningen / Grunddata / DAWA",
        "omraade": "Geodata",
        "adgang": "API",
        "filter": "Kommune 370/geometri/adresser",
        "brug": "Adresser, stednavne, administrative områder"
      },
      {
        "pri": 1,
        "kilde": "BBR / Boligejer / offentlige ejendomsdata",
        "omraade": "Ejendom",
        "adgang": "Officielle data/search",
        "filter": "Adresse/matrikel",
        "brug": "Bygninger, ejendomme, lokale udviklinger"
      },
      {
        "pri": 1,
        "kilde": "GEUS Jupiter",
        "omraade": "Miljø/vand",
        "adgang": "WFS/WMS/download/webservices",
        "filter": "Kommune=Næstved",
        "brug": "Grundvand, drikkevand, boringer, vandværker"
      },
      {
        "pri": 1,
        "kilde": "Danmarks Miljøportal / Digital MiljøAdministration",
        "omraade": "Miljø",
        "adgang": "Web/data services",
        "filter": "Kommune=Næstved + virksomheder",
        "brug": "Miljøgodkendelser, tilsyn, risikovirksomheder"
      },
      {
        "pri": 1,
        "kilde": "Miljøstyrelsen",
        "omraade": "Miljø",
        "adgang": "Web/data/nyheder",
        "filter": "Lokale anlæg, natur, jord, virksomheder",
        "brug": "Miljøsager, tilladelser, nationale afgørelser med lokal effekt"
      },
      {
        "pri": 1,
        "kilde": "Kystdirektoratet",
        "omraade": "Kyst/klima",
        "adgang": "Web/data/nyheder",
        "filter": "Karrebæksminde, Enø, fjord/kyst",
        "brug": "Højvand, diger, kystbeskyttelse, erosion"
      },
      {
        "pri": 1,
        "kilde": "Slots- og Kulturstyrelsen / Fund og Fortidsminder",
        "omraade": "Kulturarv",
        "adgang": "Offentlige databaser",
        "filter": "Næstved Kommune/geometri",
        "brug": "Fredninger, arkæologi, kulturarv"
      },
      {
        "pri": 1,
        "kilde": "Valg.dk / officielle valgdata",
        "omraade": "Demokrati",
        "adgang": "Officielle data/results",
        "filter": "Næstved Kommune/afstemningsområder",
        "brug": "Valgresultater, kandidater, stemmetal"
      },
      {
        "pri": 1,
        "kilde": "Næstved Havn",
        "omraade": "Havn/erhverv",
        "adgang": "Officiel web/nyheder + kommuneprojekt",
        "filter": "Næstved Havn/kanalen",
        "brug": "Gods, investeringer, flytning, havnebydel, drift"
      },
      {
        "pri": 1,
        "kilde": "Næstved Erhverv",
        "omraade": "Erhverv",
        "adgang": "Nyheder/arrangementer/nyhedsbrev",
        "filter": "Næstved Kommune",
        "brug": "Virksomheder, investeringer, arbejdspladser, iværksætteri"
      },
      {
        "pri": 1,
        "kilde": "Næstved Erhvervshus / Ressource City",
        "omraade": "Erhverv/grøn omstilling",
        "adgang": "Web/nyheder/events",
        "filter": "Næstved",
        "brug": "Erhvervsudvikling, cirkulær økonomi, events"
      },
      {
        "pri": 1,
        "kilde": "Næstved City",
        "omraade": "Bymidte/detail",
        "adgang": "Web/nyheder/events",
        "filter": "Næstved bymidte",
        "brug": "Butiksliv, events, detail, byudvikling"
      },
      {
        "pri": 1,
        "kilde": "Via Ritzau",
        "omraade": "Pressemeddelelser",
        "adgang": "Offentlige pressemeddelelser/search/RSS hvor muligt",
        "filter": "Steds-/entity-filter",
        "brug": "Myndigheder, virksomheder, fonde, organisationer"
      },
      {
        "pri": 1,
        "kilde": "Ritzau nyhedstjeneste",
        "omraade": "Newswire",
        "adgang": "Licenseret feed/API",
        "filter": "Geo/entity-filter",
        "brug": "Bred nyhedsstrøm; kræver aftale/licens"
      },
      {
        "pri": 2,
        "kilde": "TV2 ØST",
        "omraade": "Regionalt medie",
        "adgang": "Web/RSS hvis tilgængeligt; metadata monitor",
        "filter": "Næstved + lokalområder",
        "brug": "Discovery og krydstjek"
      },
      {
        "pri": 2,
        "kilde": "Sjællandske Nyheder / sn.dk – Næstved",
        "omraade": "Lokalt medie",
        "adgang": "Web/RSS hvis tilgængeligt; metadata monitor",
        "filter": "Næstved Kommune",
        "brug": "Discovery, konkurrentovervågning, krydstjek"
      },
      {
        "pri": 2,
        "kilde": "DR P4 Sjælland / DR regionalt",
        "omraade": "Regionalt medie",
        "adgang": "Web/app/feed hvor lovligt",
        "filter": "Steds-/entity-filter",
        "brug": "Discovery, breaking, regional kontekst"
      },
      {
        "pri": 2,
        "kilde": "DK Nyt",
        "omraade": "Kommunalmedie",
        "adgang": "Web/nyhedsbrev",
        "filter": "Næstved Kommune",
        "brug": "Kommunale og regionale historier"
      },
      {
        "pri": 2,
        "kilde": "Næstved Nyt",
        "omraade": "Lokalt medie",
        "adgang": "Web/Blogger feed/monitor",
        "filter": "Næstved + lokalområder",
        "brug": "Lokale nyheder, 112, politik, kultur, foto"
      },
      {
        "pri": 2,
        "kilde": "Næstved Netavis",
        "omraade": "Lokalt medie",
        "adgang": "Web/monitor",
        "filter": "Næstved Kommune",
        "brug": "Lokale historier, debat, erhverv, kalender"
      },
      {
        "pri": 2,
        "kilde": "Dit Næstved",
        "omraade": "Lokalt medie",
        "adgang": "Web/nyhedsbrev/monitor",
        "filter": "Næstved Kommune",
        "brug": "Events, foreninger, kommunale historier, kultur"
      },
      {
        "pri": 2,
        "kilde": "VORES Næstved / lokale VORES-sider",
        "omraade": "Aggregator",
        "adgang": "Web monitor",
        "filter": "By/postnr.",
        "brug": "Events, bolig, politi-aggregater, lokal discovery"
      },
      {
        "pri": 2,
        "kilde": "Mynewsdesk og andre PR-platforme",
        "omraade": "Pressemeddelelser",
        "adgang": "Search/feed hvor tilladt",
        "filter": "Næstved + entity",
        "brug": "Lokale pressemeddelelser"
      },
      {
        "pri": 2,
        "kilde": "Næstved Bibliotek og Borgerservice – arrangementer",
        "omraade": "Kultur/events",
        "adgang": "Struktureret eventside/monitor",
        "filter": "Næstved, Fuglebjerg, Glumsø, Korskilde",
        "brug": "Arrangementer, debat, foredrag, kultur"
      },
      {
        "pri": 2,
        "kilde": "Næstved Kommune – Foreningsportalen",
        "omraade": "Foreninger",
        "adgang": "Seed directory + crawler",
        "filter": "Hele kommunen/aktivitet",
        "brug": "Automatisk discovery af lokale foreninger"
      },
      {
        "pri": 2,
        "kilde": "Næstved Kommune – lokalråd og bylaug",
        "omraade": "Lokalsamfund",
        "adgang": "Seed directory + udgående links",
        "filter": "Lokalsamfund i hele kommunen",
        "brug": "Borgerinitiativer, møder, lokal udvikling"
      },
      {
        "pri": 2,
        "kilde": "Kommunale folkeskoler",
        "omraade": "Skole",
        "adgang": "Kommune-seed + skolewebsites",
        "filter": "18 afdelinger/kommunen",
        "brug": "Skoleevents, bestyrelser, ledelse, projekter"
      },
      {
        "pri": 2,
        "kilde": "Privat- og friskoler",
        "omraade": "Skole",
        "adgang": "Kommune-seed + officielle websites",
        "filter": "Næstved Kommune",
        "brug": "Lokale skolehistorier, elevtal, arrangementer"
      },
      {
        "pri": 2,
        "kilde": "Dagtilbud/private dagtilbud",
        "omraade": "Dagtilbud",
        "adgang": "Seed registry + selective monitor",
        "filter": "Næstved Kommune",
        "brug": "Åbning/lukning, kapacitet, events"
      },
      {
        "pri": 2,
        "kilde": "Næstved Gymnasium og HF",
        "omraade": "Uddannelse",
        "adgang": "Web/nyheder/events",
        "filter": "Næstved",
        "brug": "Ungdom, uddannelse, events"
      },
      {
        "pri": 2,
        "kilde": "ZBC Næstved",
        "omraade": "Uddannelse",
        "adgang": "Web/nyheder/events",
        "filter": "Næstved",
        "brug": "Erhvervsuddannelse, events, arbejdsmarked"
      },
      {
        "pri": 2,
        "kilde": "EUC Sjælland Næstved",
        "omraade": "Uddannelse",
        "adgang": "Web/nyheder/events",
        "filter": "Næstved",
        "brug": "Erhvervsuddannelse, teknik, arbejdsmarked"
      },
      {
        "pri": 2,
        "kilde": "Professionshøjskolen Absalon – Næstved",
        "omraade": "Uddannelse",
        "adgang": "Web/nyheder/events",
        "filter": "Næstved",
        "brug": "Videregående uddannelse, forskning, studieliv"
      },
      {
        "pri": 2,
        "kilde": "VUC Storstrøm / Næstved",
        "omraade": "Uddannelse",
        "adgang": "Web/nyheder/events",
        "filter": "Næstved",
        "brug": "Voksenuddannelse og lokale uddannelseshistorier"
      },
      {
        "pri": 2,
        "kilde": "Herlufsholm Skole og Gods",
        "omraade": "Uddannelse/institution",
        "adgang": "Web/nyheder",
        "filter": "Næstved",
        "brug": "Skole, institution, events, lokal arbejdsplads"
      },
      {
        "pri": 2,
        "kilde": "Grønnegades Kaserne Kulturcenter",
        "omraade": "Kultur",
        "adgang": "Event/nyhedssider",
        "filter": "Næstved",
        "brug": "Kultur, teater, koncerter, events"
      },
      {
        "pri": 2,
        "kilde": "Rønnebæksholm",
        "omraade": "Kunst/kultur",
        "adgang": "Web/udstillinger/events",
        "filter": "Næstved",
        "brug": "Kunst, udstillinger, bevillinger, events"
      },
      {
        "pri": 2,
        "kilde": "Museum Sydøstdanmark / Næstved Museum",
        "omraade": "Kultur/historie",
        "adgang": "Web/nyheder/events",
        "filter": "Næstved Kommune",
        "brug": "Arkæologi, kulturarv, udstillinger"
      },
      {
        "pri": 2,
        "kilde": "Næstved Arena / lokale sportsfaciliteter",
        "omraade": "Sport/events",
        "adgang": "Web/kalender/nyheder",
        "filter": "Næstved",
        "brug": "Sport, events, faciliteter"
      },
      {
        "pri": 2,
        "kilde": "Næstved Boldklub",
        "omraade": "Sport",
        "adgang": "Officiel web/nyheder",
        "filter": "Næstved",
        "brug": "Kampe, klub, økonomi, spillere"
      },
      {
        "pri": 2,
        "kilde": "Team FOG Næstved",
        "omraade": "Sport",
        "adgang": "Officiel web/nyheder",
        "filter": "Næstved",
        "brug": "Basket, kampe, klub, sponsorer"
      },
      {
        "pri": 2,
        "kilde": "Lokale idrætsforeninger",
        "omraade": "Sport",
        "adgang": "Foreningsportal seed + klubwebsites",
        "filter": "Hele kommunen",
        "brug": "Kampe, resultater, faciliteter, frivillighed"
      },
      {
        "pri": 2,
        "kilde": "Lokale kirker/sogne",
        "omraade": "Lokalsamfund",
        "adgang": "sogn.dk + officielle sider",
        "filter": "Næstved Kommune",
        "brug": "Arrangementer, udnævnelser, lokale fællesskaber"
      },
      {
        "pri": 2,
        "kilde": "Lokale kulturforeninger og spillesteder",
        "omraade": "Kultur",
        "adgang": "Foreningsportal seed + websites",
        "filter": "Hele kommunen",
        "brug": "Programmer, events, bevillinger, frivillighed"
      },
      {
        "pri": 2,
        "kilde": "Lokale virksomheders egne newsrooms",
        "omraade": "Virksomheder",
        "adgang": "CVR-seed + website-monitor",
        "filter": "Adresse i kommunen/høj lokal betydning",
        "brug": "Investeringer, fyringer, udvidelser, ledelse"
      },
      {
        "pri": 2,
        "kilde": "Officielle lokale Facebook/Instagram/LinkedIn-konti",
        "omraade": "Social signal",
        "adgang": "Officielle API'er/alerts/manual",
        "filter": "Geografi + verified account",
        "brug": "Tidlige signaler og tips; altid verificér"
      }
    ]
  }
];
