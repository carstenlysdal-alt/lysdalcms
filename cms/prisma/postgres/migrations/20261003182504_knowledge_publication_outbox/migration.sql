-- CreateTable
CREATE TABLE "KnowledgePublicationOutbox" (
    "id" TEXT NOT NULL,
    "articleRevisionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgePublicationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePublicationOutbox_articleRevisionId_key" ON "KnowledgePublicationOutbox"("articleRevisionId");

-- AddForeignKey
ALTER TABLE "KnowledgePublicationOutbox" ADD CONSTRAINT "KnowledgePublicationOutbox_articleRevisionId_fkey" FOREIGN KEY ("articleRevisionId") REFERENCES "ArticleRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
