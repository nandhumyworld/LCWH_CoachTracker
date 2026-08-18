"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCoach } from "@/lib/auth-guards";
import { scheduleGateMessage, type ScheduleGateResult } from "@/lib/gate";
import { storeImageForCoach } from "@/lib/images";

export interface GateUploadResult {
  ok: boolean;
  error?: string;
  imageId?: string;
}

// Uploads a picture for a daily gate message (coach-owned image, CR-013).
export async function uploadGateImageAction(
  formData: FormData,
): Promise<GateUploadResult> {
  const { coachId } = await requireCoach();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeImageForCoach(coachId, { buffer, mimeType: file.type });
  if (!stored.ok) return { ok: false, error: stored.error };
  return { ok: true, imageId: stored.id };
}

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
