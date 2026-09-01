import { z } from "zod";

export const ROLE_OPTIONS = ["coach", "admin"] as const;
export const STUDENT_STATUS_OPTIONS = ["invited", "active", "paused"] as const;

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().email("Enter a valid email."),
  role: z.enum(ROLE_OPTIONS),
});

export const identitySchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().email("Enter a valid email."),
});

export const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const studentProfileSchema = z
  .object({
    timezone: z.string().min(1, "Timezone is required."),
    status: z.enum(STUDENT_STATUS_OPTIONS),
    coachId: z.string().min(1, "Coach is required."),
    heightCm: z.number().positive(),
    currentWeightKg: z.number().positive(),
    targetWeightKg: z.number().positive(),
  })
  .refine((d) => d.targetWeightKg <= d.currentWeightKg, {
    message: "Target weight should not exceed current weight.",
    path: ["targetWeightKg"],
  });

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Validates an IANA timezone against the runtime's known zones.
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type AuditDetails = Record<string, { from: unknown; to: unknown }>;

// Field-level before/after diff. Only include fields present in `after` and
// actually changed. Never pass password values in.
export function buildAuditDetails<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[],
): AuditDetails {
  const details: AuditDetails = {};
  for (const f of fields) {
    if (f in after && after[f] !== before[f]) {
      details[f as string] = { from: before[f], to: after[f] };
    }
  }
  return details;
}
