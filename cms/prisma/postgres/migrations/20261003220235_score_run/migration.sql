-- CreateTable
CREATE TABLE "ScoreRun" (
    "id" TEXT NOT NULL,
    "instansId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "estimater" JSONB NOT NULL,
    "analyse" JSONB NOT NULL,
    "udbyder" TEXT,
    "modelId" TEXT,
    "tokensInd" INTEGER,
    "tokensUd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreRun_instansId_signalId_createdAt_idx" ON "ScoreRun"("instansId", "signalId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreRun_instansId_createdAt_idx" ON "ScoreRun"("instansId", "createdAt");

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_instansId_fkey" FOREIGN KEY ("instansId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

