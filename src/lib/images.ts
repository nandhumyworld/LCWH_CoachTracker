import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { getPhotoRetentionDays } from "@/lib/settings";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB, matches next.config bodySizeLimit

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

export type StoreImageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

// Validates an uploaded image's MIME + size; returns the file extension.
function validateImage(file: {
  buffer: Buffer;
  mimeType: string;
}): { ok: true; ext: string; mimeType: string } | { ok: false; error: string } {
  const mimeType = file.mimeType.toLowerCase();
  if (!mimeType.startsWith("image/")) return { ok: false, error: "Only images are allowed." };
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) return { ok: false, error: "Unsupported image type." };
  if (file.buffer.byteLength > MAX_BYTES)
    return { ok: false, error: "Image is too large (max 10MB)." };
  return { ok: true, ext, mimeType };
}

// Persists an uploaded student photo via the StorageService and records a
// StoredImage pointer row (bytes never touch Postgres — NFR-2). Sets expiry for
// the retention job (NFR-3).
export async function storeImageForStudent(
  studentId: string,
  dailyEntryId: string | null,
  file: { buffer: Buffer; mimeType: string },
): Promise<StoreImageResult> {
  const v = validateImage(file);
  if (!v.ok) return v;

  const key = `students/${studentId}/${randomUUID()}.${v.ext}`;
  await getStorage().put({ key, body: file.buffer, mimeType: v.mimeType });

  const retentionDays = await getPhotoRetentionDays();
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

  const row = await prisma.storedImage.create({
    data: {
      storageKey: key,
      ownerStudentId: studentId,
      dailyEntryId,
      mimeType: v.mimeType,
      bytes: file.buffer.byteLength,
      expiresAt,
    },
  });
  return { ok: true, id: row.id };
}

// Persists a coach-owned image (e.g. a daily-message picture, CR-013). Viewable
// by the coach and their students. Not subject to photo retention (no expiry).
export async function storeImageForCoach(
  coachId: string,
  file: { buffer: Buffer; mimeType: string },
): Promise<StoreImageResult> {
  const v = validateImage(file);
  if (!v.ok) return v;

  const key = `coach/${coachId}/${randomUUID()}.${v.ext}`;
  await getStorage().put({ key, body: file.buffer, mimeType: v.mimeType });

  const row = await prisma.storedImage.create({
    data: {
      storageKey: key,
      ownerCoachId: coachId,
      mimeType: v.mimeType,
      bytes: file.buffer.byteLength,
    },
  });
  return { ok: true, id: row.id };
}

// Whether `user` may view an image given its owner. Coach-owned images are
// viewable by the owning coach and that coach's students; student-owned images
// by the owner student, their coach, or any admin (NFR-4).
export async function canViewImage(
  user: { id: string; role: "admin" | "coach" | "student" },
  image: { ownerStudentId: string | null; ownerCoachId: string | null },
): Promise<boolean> {
  if (user.role === "admin") return true;

  if (image.ownerCoachId) {
    if (user.role === "coach") {
      const coach = await prisma.coach.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      return coach?.id === image.ownerCoachId;
    }
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { coachId: true },
    });
    return student?.coachId === image.ownerCoachId;
  }

  if (image.ownerStudentId) {
    const owner = await prisma.student.findUnique({
      where: { id: image.ownerStudentId },
      select: { userId: true, coachId: true },
    });
    if (!owner) return false;
    if (user.role === "student") return owner.userId === user.id;
    if (user.role === "coach") {
      const coach = await prisma.coach.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      return coach?.id === owner.coachId;
    }
  }
  return false;
}
