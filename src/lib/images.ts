import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { env } from "@/lib/env";

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

// Persists an uploaded image via the StorageService and records a StoredImage
// pointer row (bytes never touch Postgres — NFR-2). Sets expiry for the
// retention job (NFR-3).
export async function storeImageForStudent(
  studentId: string,
  dailyEntryId: string | null,
  file: { buffer: Buffer; mimeType: string },
): Promise<StoreImageResult> {
  const mimeType = file.mimeType.toLowerCase();
  if (!mimeType.startsWith("image/")) return { ok: false, error: "Only images are allowed." };
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) return { ok: false, error: "Unsupported image type." };
  if (file.buffer.byteLength > MAX_BYTES) return { ok: false, error: "Image is too large (max 10MB)." };

  const key = `students/${studentId}/${randomUUID()}.${ext}`;
  await getStorage().put({ key, body: file.buffer, mimeType });

  const expiresAt = new Date(
    Date.now() + env.PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const row = await prisma.storedImage.create({
    data: {
      storageKey: key,
      ownerStudentId: studentId,
      dailyEntryId,
      mimeType,
      bytes: file.buffer.byteLength,
      expiresAt,
    },
  });
  return { ok: true, id: row.id };
}

// Whether `user` may view the image owned by `ownerStudentId`. Owner student,
// that student's coach, or any admin (NFR-4).
export async function canViewImage(
  user: { id: string; role: "admin" | "coach" | "student" },
  ownerStudentId: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const owner = await prisma.student.findUnique({
    where: { id: ownerStudentId },
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
  return false;
}
