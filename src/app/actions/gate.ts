"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCoach } from "@/lib/auth-guards";
import { scheduleGateMessage, type ScheduleGateResult } from "@/lib/gate";

const input = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  bodyText: z.string().min(1, "Message text is required."),
  imageRefId: z.string().optional().nullable(),
  ackButtonLabel: z.string().optional(),
});

// Coach schedules (or replaces) the login-gate message for a date (FR-19/20).
export async function scheduleGateAction(
  raw: z.infer<typeof input>,
): Promise<ScheduleGateResult> {
  const { coachId } = await requireCoach();
  const parsed = input.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const res = await scheduleGateMessage({ coachId, ...parsed.data });
  if (res.ok) revalidatePath("/coach/gate");
  return res;
}
