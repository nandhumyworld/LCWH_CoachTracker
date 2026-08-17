import { prisma } from "@/lib/db";
import { isPastLocalCutoff } from "@/lib/day";
import {
  finalStatusForAutoSubmit,
  dbDateToLocalDateString,
} from "@/lib/auto-submit-util";
import { generateReport } from "@/lib/report";

export interface AutoSubmitSummary {
  scanned: number;
  processed: number;
}

// Finds students whose local time has passed 23:59 with an `open` DailyEntry,
// auto-submits them (recording whatever was entered), and enqueues report
// generation. Idempotent: only `open` entries are touched (spec §7, FR-17).
//
// NOTE (follow-up): this processes existing open entries only. A student who
// never opened the form has no entry, so no "missed" row is created for them.
// Creating entries for all active students on their prior local date is a
// possible enhancement for stricter attendance/reporting.
export async function runAutoSubmit(
  now: Date = new Date(),
): Promise<AutoSubmitSummary> {
  const openEntries = await prisma.dailyEntry.findMany({
    where: { status: "open" },
    include: {
      student: { select: { timezone: true } },
      _count: { select: { answers: true } },
    },
  });

  let processed = 0;
  for (const entry of openEntries) {
    const localDate = dbDateToLocalDateString(entry.localDate);
    if (!isPastLocalCutoff(entry.student.timezone, localDate, now)) continue;

    const status = finalStatusForAutoSubmit(entry._count.answers);
    await prisma.$transaction([
      prisma.dailyEntry.update({
        where: { id: entry.id },
        data: { status, submittedAt: now },
      }),
      prisma.report.upsert({
        where: { dailyEntryId: entry.id },
        update: {},
        create: { dailyEntryId: entry.id, status: "pending" },
      }),
    ]);

    // Enqueue report generation. Failures here must not abort the sweep — the
    // report is already pending and can be retried from Admin logs.
    try {
      await generateReport(entry.id);
    } catch {
      // swallow; report stays pending/failed and is retryable
    }
    processed++;
  }

  return { scanned: openEntries.length, processed };
}
