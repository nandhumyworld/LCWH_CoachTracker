-- AlterTable
ALTER TABLE "StoredImage" ADD COLUMN     "ownerCoachId" TEXT,
ALTER COLUMN "ownerStudentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "StoredImage_ownerCoachId_idx" ON "StoredImage"("ownerCoachId");

-- AddForeignKey
ALTER TABLE "StoredImage" ADD CONSTRAINT "StoredImage_ownerCoachId_fkey" FOREIGN KEY ("ownerCoachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

