"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getSessionUser } from "@/lib/auth-guards";
import {
  generateReport,
  runReportPipeline,
} from "@/lib/report";
import { runExtraction } from "@/lib/extraction";

export interface RetryResult {
  ok: boolean;
  error?: string;
}

// Re-runs AI generation for a report (Admin-only, FR-29/30). Resets the row to
// pending, then regenerates (extraction + report).
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
  await runReportPipeline(report.dailyEntryId);

  revalidatePath("/admin/logs");
  return { ok: true };
}

export type RegenStage = "extraction" | "report" | "both";

// On-demand regeneration for BOTH coach and admin, anytime (CR-010). A coach may
// only regenerate their own students' reports; an admin may regenerate any.
// After editing the extraction/report prompt or model, re-running a stage
// applies the change to an existing day.
export async function regenerateReportAction(input: {
  dailyEntryId: string;
  stage: RegenStage;
}): Promise<RetryResult> {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "coach"))
    return { ok: false, error: "Not allowed." };

  const entry = await prisma.dailyEntry.findUnique({
    where: { id: input.dailyEntryId },
    select: { id: true, student: { select: { coachId: true } } },
  });
  if (!entry) return { ok: false, error: "Entry not found." };

  if (user.role === "coach") {
    const coach = await prisma.coach.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!coach || coach.id !== entry.student.coachId)
      return { ok: false, error: "Not allowed." };
  }

  if (input.stage === "extraction") {
    await runExtraction(entry.id);
  } else {
    // report | both — ensure a Report row exists and mark it regenerating.
    await prisma.report.upsert({
      where: { dailyEntryId: entry.id },
      update: { status: "pending", error: null },
      create: { dailyEntryId: entry.id, status: "pending" },
    });
    if (input.stage === "both") await runReportPipeline(entry.id);
    else await generateReport(entry.id);
  }

  revalidatePath("/admin/logs");
  revalidatePath(`/coach/students`);
  revalidatePath("/student");
  return { ok: true };
}
