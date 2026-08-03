import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { PERMISSIONS } from "../lib/permissions";

const db = new PrismaClient();

const categories = ["Nyheder", "Politik", "Erhverv", "Kultur", "Sport", "Debat"];
const areas = ["Slagelse", "Korsør", "Skælskør", "Hashøj", "Vemmelev"];

const roles = [
  { navn: "Ansvarshavende redaktør", permissions: Object.values(PERMISSIONS) },
  { navn: "Redaktionsleder", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.ARTICLE_EDIT_ALL, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL, PERMISSIONS.SUPPORT_READ, PERMISSIONS.HONORAR_VIEW, PERMISSIONS.HONOR_MANAGE, PERMISSIONS.TASK_MANAGE, PERMISSIONS.TASK_VIEW_ALL, PERMISSIONS.FRONTPAGE_EDIT] },
  { navn: "Freelancejournalist", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL, PERMISSIONS.HONOR_VIEW_OWN] },
  { navn: "Medieproducent", permissions: [PERMISSIONS.MEDIA_MANAGE, PERMISSIONS.HONOR_VIEW_OWN] },
  { navn: "Community manager", permissions: [PERMISSIONS.ARTICLE_CREATE] },
  { navn: "Salgs- og partnerskabsansvarlig", permissions: [PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_MANAGE] },
  { navn: "Teknisk produktansvarlig", permissions: [PERMISSIONS.USERS_MANAGE] },
  { navn: "Støtte", permissions: [PERMISSIONS.SUPPORT_READ] },
] as const;

async function main() {
  const instance = await db.instance.upsert({
    where: { id: "slagelse-reference" },
    update: {},
    create: {
      id: "slagelse-reference",
      navn: "Slagelse Lokalmedie",
      domaene: "slagelse.test",
      farver: { accent: "#ec3013", bg: "#f3f2f2", text: "#201e1d" },
      typografi: { heading: "Archivo", body: "Archivo" },
      geografiskDækning: areas,
      kategoriTaksonomi: categories,
      markingTekster: {
        sponsorLabel: "Sponsoreret indhold",
        partnerLabel: "Partnerindhold",
        principperUrl: "/redaktionelle-principper",
      },
    },
  });

  const roleMap = new Map<string, string>();
  for (const role of roles) {
    const saved = await db.role.upsert({
      where: { navn: role.navn },
      update: { permissions: [...role.permissions] },
      create: { navn: role.navn, permissions: [...role.permissions] },
    });
    roleMap.set(role.navn, saved.id);
  }

  for (const navn of categories) {
    const slug = navn.toLocaleLowerCase("da").replaceAll("æ", "ae").replaceAll("ø", "oe").replaceAll("å", "aa").replace(/[^a-z0-9]+/g, "-");
    await db.category.upsert({
      where: { instansId_slug: { instansId: instance.id, slug } },
      update: { navn },
      create: { navn, slug, instansId: instance.id },
    });
  }
  for (const navn of areas) {
    await db.geoTag.upsert({
      where: { instansId_navn: { instansId: instance.id, navn } },
      update: {},
      create: { navn, instansId: instance.id },
    });
  }
  for (const navn of ["Kommunalpolitik", "Byliv", "Iværksætteri", "Familie"]) {
    await db.tag.upsert({
      where: { instansId_navn: { instansId: instance.id, navn } },
      update: {},
      create: { navn, instansId: instance.id },
    });
  }

  const rates = [
    ["Kort nyhedsartikel", 300, 500, 400], ["Standardartikel", 600, 1000, 800],
    ["Dybdegående artikel/reportage", 1500, 2500, 2000], ["Interview", 800, 1400, 1100],
    ["Fotoreportage", 500, 1200, 850], ["Lydreportage/podcast", 1200, 2500, 1800],
    ["Videoproduktion", 2000, 4000, 3000], ["Live-dækning", 400, 600, 500],
    ["Opdatering af artikel", 150, 300, 225], ["Researchopgave", 300, 400, 350],
  ] as const;
  for (const [leverancetype, minimum, maksimum, standard] of rates) {
    await db.honorRate.upsert({
      where: { instansId_leverancetype: { instansId: instance.id, leverancetype } },
      update: { minimum, maksimum, standard, aktiv: true },
      create: { leverancetype, minimum, maksimum, standard, instansId: instance.id },
    });
  }

  const editorAuthor = await db.author.upsert({
    where: { id: "author-editor" }, update: {},
    create: { id: "author-editor", navn: "Rikke Redaktør", forfatterType: "Fast", instansId: instance.id },
  });
  const journalistAuthor = await db.author.upsert({
    where: { id: "author-journalist" }, update: {},
    create: { id: "author-journalist", navn: "Jonas Journalist", forfatterType: "Freelance", instansId: instance.id },
  });

  const passwordHash = await hash("cms-demo-2026", 12);
  await db.user.upsert({
    where: { email: "redaktoer@slagelse.test" },
    update: { passwordHash, roleId: roleMap.get("Ansvarshavende redaktør")!, authorId: editorAuthor.id },
    create: { email: "redaktoer@slagelse.test", navn: "Rikke Redaktør", passwordHash, roleId: roleMap.get("Ansvarshavende redaktør")!, instansId: instance.id, authorId: editorAuthor.id },
  });
  await db.user.upsert({
    where: { email: "journalist@slagelse.test" },
    update: { passwordHash, roleId: roleMap.get("Freelancejournalist")!, authorId: journalistAuthor.id },
    create: { email: "journalist@slagelse.test", navn: "Jonas Journalist", passwordHash, roleId: roleMap.get("Freelancejournalist")!, instansId: instance.id, authorId: journalistAuthor.id },
  });

  const news = await db.category.findUniqueOrThrow({ where: { instansId_slug: { instansId: instance.id, slug: "nyheder" } } });
  await db.article.upsert({
    where: { slug: "velkommen-til-redaktionen" },
    update: {},
    create: {
      titel: "Velkommen til redaktionen",
      manchet: "En publiceret demoartikel, der viser læse-API'et.",
      slug: "velkommen-til-redaktionen",
      blocks: [{ id: "demo-p", type: "paragraph", data: { content: "<p>CMS-fundamentet er klar til redaktionelt arbejde.</p>" } }],
      status: "Publiceret", indholdstype: "Uafhængig", aiBrug: ["Ingen"],
      pinned: true, publiceretTid: new Date(), kategoriId: news.id,
      forfatterId: editorAuthor.id, instansId: instance.id,
    },
  });
  const sponsoredDraft = await db.article.upsert({
    where: { slug: "sponsoreret-kladde-uden-maerkning" },
    update: {},
    create: {
      titel: "Sponsoreret kladde uden mærkning",
      slug: "sponsoreret-kladde-uden-maerkning",
      blocks: [{ id: "demo-sponsored", type: "paragraph", data: { content: "<p>Denne kladde bruges til at afprøve AC-01.</p>" } }],
      status: "Godkendelse", indholdstype: "Sponsoreret", aiBrug: ["Ingen"],
      breaking: true, kategoriId: news.id, forfatterId: journalistAuthor.id, instansId: instance.id,
    },
  });
  const editorUser = await db.user.findUniqueOrThrow({ where: { email: "redaktoer@slagelse.test" } });
  await db.assignment.upsert({
    where: { id: "assignment-demo" },
    update: {},
    create: {
      id: "assignment-demo", titel: "Gør sponsoreret demoartikel klar",
      beskrivelse: "Gennemgå research, mærkning og metadata, og aflever artiklen til redaktionel godkendelse.",
      leverancetype: "Standardartikel", status: "Afleveret", iPulje: false,
      researchDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      afleveringsDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      estimeretHonorar: 800, interessekonflikt: "Ingen", instansId: instance.id,
      assignedAuthorId: journalistAuthor.id, articleId: sponsoredDraft.id, createdById: editorUser.id,
    },
  });
}

main()
  .then(() => console.log("Seed færdig: redaktør + journalist, password: cms-demo-2026"))
  .finally(() => db.$disconnect());
