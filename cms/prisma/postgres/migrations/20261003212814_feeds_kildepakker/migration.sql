-- AlterTable
ALTER TABLE "FeedDefinition" ADD COLUMN     "kategori" TEXT,
ADD COLUMN     "prioritet" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "sidstHentet" TIMESTAMP(3),
ADD COLUMN     "sidsteAntal" INTEGER,
ADD COLUMN     "sidsteBesked" TEXT,
ADD COLUMN     "sidsteStatus" TEXT;

-- CreateIndex
CREATE INDEX "FeedDefinition_instansId_kategori_idx" ON "FeedDefinition"("instansId", "kategori");

