-- CreateEnum
CREATE TYPE "PromptTemplateKind" AS ENUM ('report', 'extraction');

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "derived" JSONB;

-- AlterTable
ALTER TABLE "ProgramSettings" ADD COLUMN     "extractionTemplateId" TEXT;

-- AlterTable
ALTER TABLE "PromptTemplate" ADD COLUMN     "kind" "PromptTemplateKind" NOT NULL DEFAULT 'report';

-- AddForeignKey
ALTER TABLE "ProgramSettings" ADD CONSTRAINT "ProgramSettings_extractionTemplateId_fkey" FOREIGN KEY ("extractionTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

