import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

// Reset a single day's check-in so the student can fill it again (coach tool +
// manual-testing aid). Reopens the DailyEntry and removes everything generated
// for that day: answers, the report, and the day's uploaded images (both the DB
// rows and the bytes on disk). The entry row itself is kept so its
// (studentId, localDate) slot stays stable.
//
// Best-effort on storage: DB rows are deleted transactionally; byte deletion is
// idempotent and runs after, so a missing/already-gone file never fails a reset.
export interface ResetResult {
  answersDeleted: number;
  imagesDeleted: number;
  reportDeleted: boolean;
}

export async function resetDailyEntry(
  dailyEntryId: string,
): Promise<ResetResult> {
  const entry = await prisma.dailyEntry.findUnique({
    where: { id: dailyEntryId },
    select: {
      id: true,
      images: { select: { id: true, storageKey: true } },
    },
  });
  if (!entry) throw new Error(`DailyEntry ${dailyEntryId} not found.`);

  const storageKeys = entry.images.map((img) => img.storageKey);

  // Delete children before the images they reference, then reopen the day.
  const [report, answers, images] = await prisma.$transaction([
    prisma.report.deleteMany({ where: { dailyEntryId } }),
    prisma.answer.deleteMany({ where: { dailyEntryId } }),
    prisma.storedImage.deleteMany({ where: { dailyEntryId } }),
    prisma.dailyEntry.update({
      where: { id: dailyEntryId },
      data: { status: "open", submittedAt: null },
    }),
  ]);

  // Remove the bytes from disk (idempotent; never throws the whole reset).
  const storage = getStorage();
  await Promise.all(
    storageKeys.map((key) => storage.delete(key).catch(() => undefined)),
  );

  return {
    answersDeleted: answers.count,
    imagesDeleted: images.count,
    reportDeleted: report.count > 0,
  };
}
