import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { PERMISSIONS } from "../lib/permissions";

const db = new PrismaClient();

const categories = ["Nyheder", "Politik", "Erhverv", "Kultur", "Sport", "Debat"];
const areas = ["Slagelse", "Korsør", "Skælskør", "Hashøj", "Vemmelev"];

const roles = [
  { navn: "Ansvarshavende redaktør", permissions: Object.values(PERMISSIONS) },
  { navn: "Redaktionsleder", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.ARTICLE_EDIT_ALL, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL, PERMISSIONS.SUPPORT_READ, PERMISSIONS.HONORAR_VIEW, PERMISSIONS.FRONTPAGE_EDIT] },
  { navn: "Freelancejournalist", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL] },
  { navn: "Medieproducent", permissions: [PERMISSIONS.MEDIA_MANAGE] },
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
  await db.article.upsert({
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
}

main()
  .then(() => console.log("Seed færdig: redaktør + journalist, password: cms-demo-2026"))
  .finally(() => db.$disconnect());
