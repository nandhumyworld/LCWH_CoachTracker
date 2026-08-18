import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Only the SHA-256 hash of the token is stored; the raw token lives only in the
// invite URL handed to the user.
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface CreatedInvite {
  token: string; // raw, include in the URL once
  expiresAt: Date;
}

// Issues an invite for an existing user (used by the coach invite flow).
export async function createInvite(userId: string): Promise<CreatedInvite> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await prisma.inviteToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used" };

// Validates an invite token and sets the user's password. On success, marks the
// token used and activates a student user.
export async function consumeInvite(
  rawToken: string,
  newPassword: string,
): Promise<ConsumeResult> {
  const invite = await prisma.inviteToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { include: { student: true } } },
  });

  if (!invite) return { ok: false, reason: "invalid" };
  if (invite.usedAt) return { ok: false, reason: "used" };
  if (invite.expiresAt.getTime() < Date.now())
    return { ok: false, reason: "expired" };

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: invite.userId },
      data: { passwordHash },
    }),
    prisma.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
    // Activate a student on first password set.
    ...(invite.user.student
      ? [
          prisma.student.update({
            where: { id: invite.user.student.id },
            data: { status: "active" },
          }),
        ]
      : []),
  ]);

  return { ok: true };
}
