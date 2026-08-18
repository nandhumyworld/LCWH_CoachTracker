"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth-guards";
import { acknowledgeGate, gateForStudentToday } from "@/lib/gate";

export interface AckResult {
  ok: boolean;
  error?: string;
}

// Student acknowledges today's gate message; recording it = attendance (FR-23).
// Verifies the message is actually the student's gate for today before writing,
// so a stale/foreign gate id can't be acknowledged.
export async function acknowledgeGateAction(
  gateMessageId: string,
): Promise<AckResult> {
  const { studentId } = await requireStudent();
  const { message } = await gateForStudentToday(studentId);
  if (!message || message.id !== gateMessageId)
    return { ok: false, error: "This message is no longer active." };

  await acknowledgeGate(gateMessageId, studentId);
  revalidatePath("/student");
  return { ok: true };
}
