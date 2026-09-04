import { z } from "zod";

// Question types mirror the Prisma `QuestionType` enum. Kept as a const here so
// pure validation logic has no Prisma import and stays unit-testable.
export const QUESTION_TYPES = [
  "short_text",
  "number",
  "date",
  "paragraph",
  "multiple_choice",
  "checkboxes",
  "linear_scale",
  "image",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

// Normalizes a placeholder key to a stable slug (letters/digits/underscore),
// e.g. "Lunch Photo 🍱" -> "lunch_photo". Used for {{q.<key>}} placeholders.
export function toKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export interface QuestionLike {
  type: QuestionType;
  options?: unknown;
  required?: boolean;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Per-type option schemas (what the coach configures on a question)
// ---------------------------------------------------------------------------

const numberOptions = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    gt: z.number().optional(),
    lt: z.number().optional(),
    integer: z.boolean().optional(),
  })
  .strict();

const choicesOptions = z
  .object({ choices: z.array(z.string().min(1)).min(1) })
  .strict();

const scaleOptions = z
  .object({
    min: z.number().int(),
    max: z.number().int(),
    minLabel: z.string().optional(),
    maxLabel: z.string().optional(),
  })
  .strict()
  .refine((o) => o.min < o.max, { message: "min must be less than max" });

const emptyOptions = z.object({}).strict().optional();

// Returns the zod schema for a type's `options` payload.
export function optionsSchemaFor(type: QuestionType): z.ZodTypeAny {
  switch (type) {
    case "number":
      return numberOptions;
    case "multiple_choice":
    case "checkboxes":
      return choicesOptions;
    case "linear_scale":
      return scaleOptions;
    default:
      return emptyOptions;
  }
}

// ---------------------------------------------------------------------------
// Answer validation (what a student submits for a question)
// ---------------------------------------------------------------------------

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

const fail = (error: string): ValidationResult => ({ ok: false, error });
const ok: ValidationResult = { ok: true };

export function validateAnswerValue(
  question: QuestionLike,
  value: unknown,
): ValidationResult {
  if (isEmpty(value)) {
    return question.required ? fail("This question is required.") : ok;
  }

  switch (question.type) {
    case "short_text":
    case "paragraph":
      return typeof value === "string" ? ok : fail("Expected text.");

    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (typeof value !== "number" || Number.isNaN(n))
        return fail("Expected a number.");
      const o = numberOptions.partial().parse(question.options ?? {});
      if (o.integer && !Number.isInteger(n)) return fail("Must be a whole number.");
      if (o.min !== undefined && n < o.min) return fail(`Must be ≥ ${o.min}.`);
      if (o.max !== undefined && n > o.max) return fail(`Must be ≤ ${o.max}.`);
      if (o.gt !== undefined && !(n > o.gt)) return fail(`Must be greater than ${o.gt}.`);
      if (o.lt !== undefined && !(n < o.lt)) return fail(`Must be less than ${o.lt}.`);
      return ok;
    }

    case "linear_scale": {
      const parsed = scaleOptions.safeParse(question.options);
      if (!parsed.success) return fail("Scale is misconfigured.");
      const { min, max } = parsed.data;
      if (typeof value !== "number" || !Number.isInteger(value))
        return fail("Expected a whole number.");
      if (value < min || value > max) return fail(`Must be between ${min} and ${max}.`);
      return ok;
    }

    case "date": {
      if (typeof value !== "string") return fail("Expected a date.");
      const t = Date.parse(value);
      return Number.isNaN(t) ? fail("Enter a valid date.") : ok;
    }

    case "multiple_choice": {
      const parsed = choicesOptions.safeParse(question.options);
      if (!parsed.success) return fail("Choices are misconfigured.");
      return parsed.data.choices.includes(value as string)
        ? ok
        : fail("Select one of the options.");
    }

    case "checkboxes": {
      const parsed = choicesOptions.safeParse(question.options);
      if (!parsed.success) return fail("Choices are misconfigured.");
      if (!Array.isArray(value)) return fail("Expected a list of selections.");
      const allowed = new Set(parsed.data.choices);
      return value.every((v) => allowed.has(v as string))
        ? ok
        : fail("Contains an invalid option.");
    }

    case "image":
      // Value is the StoredImage id/ref; presence was already checked above.
      return typeof value === "string" ? ok : fail("Expected an uploaded image.");
  }
}
