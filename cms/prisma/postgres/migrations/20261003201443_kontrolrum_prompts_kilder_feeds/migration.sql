-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "noegle" TEXT NOT NULL,
    "indhold" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "opdateretAf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptRevision" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "indhold" TEXT NOT NULL,
    "note" TEXT,
    "aendretAf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceProfile" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'andet',
    "domaene" TEXT,
    "score" INTEGER NOT NULL DEFAULT 50,
    "note" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedDefinition" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rss',
    "url" TEXT,
    "sourceType" TEXT,
    "omraadeTekst" TEXT,
    "inkluder" JSONB NOT NULL,
    "ekskluder" JSONB NOT NULL,
    "intervalMin" INTEGER NOT NULL DEFAULT 30,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "noter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptTemplate_instansId_idx" ON "PromptTemplate"("instansId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_instansId_noegle_key" ON "PromptTemplate"("instansId", "noegle");

-- CreateIndex
CREATE INDEX "PromptRevision_instansId_createdAt_idx" ON "PromptRevision"("instansId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptRevision_promptId_version_key" ON "PromptRevision"("promptId", "version");

-- CreateIndex
CREATE INDEX "SourceProfile_instansId_aktiv_idx" ON "SourceProfile"("instansId", "aktiv");

-- CreateIndex
CREATE INDEX "SourceProfile_instansId_domaene_idx" ON "SourceProfile"("instansId", "domaene");

-- CreateIndex
CREATE UNIQUE INDEX "SourceProfile_instansId_navn_key" ON "SourceProfile"("instansId", "navn");

-- CreateIndex
CREATE INDEX "FeedDefinition_instansId_aktiv_idx" ON "FeedDefinition"("instansId", "aktiv");

-- CreateIndex
CREATE UNIQUE INDEX "FeedDefinition_instansId_navn_key" ON "FeedDefinition"("instansId", "navn");

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRevision" ADD CONSTRAINT "PromptRevision_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "PromptTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRevision" ADD CONSTRAINT "PromptRevision_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceProfile" ADD CONSTRAINT "SourceProfile_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedDefinition" ADD CONSTRAINT "FeedDefinition_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

