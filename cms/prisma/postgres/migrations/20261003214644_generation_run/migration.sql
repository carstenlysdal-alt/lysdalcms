-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profil" TEXT NOT NULL,
    "vinkel" TEXT,
    "kategoriId" TEXT,
    "kilder" JSONB NOT NULL,
    "resultat" JSONB NOT NULL,
    "advarsler" JSONB NOT NULL,
    "statistik" JSONB NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "modelId" TEXT,
    "udbyder" TEXT,
    "tokensInd" INTEGER,
    "tokensUd" INTEGER,
    "articleId" TEXT,
    "udloebTid" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationRun_instansId_createdAt_idx" ON "GenerationRun"("instansId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationRun_instansId_userId_idx" ON "GenerationRun"("instansId", "userId");

-- CreateIndex
CREATE INDEX "GenerationRun_udloebTid_idx" ON "GenerationRun"("udloebTid");

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

