"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { generateReport } from "@/lib/report";

export interface RetryResult {
  ok: boolean;
  error?: string;
}

// Re-runs AI generation for a report (Admin-only, FR-29/30). Resets the row to
// pending, then regenerates. generateReport records its own outcome and does
// not throw, so the result is reflected on the Report after this returns.
export async function retryReport(reportId: string): Promise<RetryResult> {
  await requireRole("admin");

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { dailyEntryId: true },
  });
  if (!report) return { ok: false, error: "Report not found." };

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "pending", error: null },
  });
  await generateReport(report.dailyEntryId);

  revalidatePath("/admin/logs");
  return { ok: true };
}
