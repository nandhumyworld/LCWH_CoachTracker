"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { homePathForRole } from "@/lib/auth-helpers";
import { consumeInvite } from "@/lib/invites";

export interface ActionState {
  error?: string;
  done?: boolean;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Credentials sign-in. On success, next-auth throws a redirect to the role
// home; we compute that target from the user's role first.
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.trim().toLowerCase() },
    select: { role: true },
  });
  const redirectTo = user ? homePathForRole(user.role) : "/";

  try {
    await signIn("credentials", { ...parsed.data, redirectTo });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw err; // re-throw redirect + unexpected errors
  }
}

const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

// Consumes an invite token and sets the password.
export async function setPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await consumeInvite(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    const msg =
      result.reason === "expired"
        ? "This invite link has expired. Ask your coach for a new one."
        : result.reason === "used"
          ? "This invite link was already used. Try logging in."
          : "This invite link is invalid.";
    return { error: msg };
  }
  return { done: true };
}

// Sign out and return to the login screen.
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
