"use server";

import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth-guards";
import { saveAnswer, EntryLockedError } from "@/lib/daily-entry";
import { storeImageForStudent } from "@/lib/images";

export interface UploadResult {
  ok: boolean;
  error?: string;
  imageId?: string;
  url?: string;
}

// Uploads a photo and links it to the answer's imageRefId. For an image-type
// question the photo IS the answer (value is set to the image id so required
// validation passes). For any other question with allowsImage (CR-006) the photo
// is supplemental — only imageRefId is set, the scalar answer value is untouched.
export async function uploadPhotoAction(
  formData: FormData,
): Promise<UploadResult> {
  const { studentId } = await requireStudent();
  const dailyEntryId = String(formData.get("dailyEntryId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) return { ok: false, error: "No file provided." };

  const [entry, question] = await Promise.all([
    prisma.dailyEntry.findUnique({
      where: { id: dailyEntryId },
      select: { studentId: true, status: true },
    }),
    prisma.question.findUnique({
      where: { id: questionId },
      select: { type: true },
    }),
  ]);
  if (!entry || entry.studentId !== studentId)
    return { ok: false, error: "Entry not found." };
  if (entry.status !== "open")
    return { ok: false, error: "This day is locked." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeImageForStudent(studentId, dailyEntryId, {
    buffer,
    mimeType: file.type,
  });
  if (!stored.ok) return { ok: false, error: stored.error };

  const isImageAnswer = question?.type === "image";
  try {
    await saveAnswer(
      isImageAnswer
        ? { dailyEntryId, questionId, value: stored.id, imageRefId: stored.id }
        : { dailyEntryId, questionId, imageRefId: stored.id },
    );
  } catch (err) {
    if (err instanceof EntryLockedError) return { ok: false, error: err.message };
    throw err;
  }

  return { ok: true, imageId: stored.id, url: `/api/images/${stored.id}` };
}
