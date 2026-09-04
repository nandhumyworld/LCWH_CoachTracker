// Prompt placeholder filling (pure — no Prisma/IO, unit-tested).
//
// The admin-authored PromptTemplate body contains `{{q.<key>}}` and
// `{{profile.<field>}}` placeholders. `fillPrompt` renders the text for a given
// daily entry: scalar/text/choice answers are inlined; image answers are pulled
// out as vision inputs (the token is removed from the text and the image id is
// collected so the caller can attach the bytes to the OpenRouter request).
// Unknown placeholders render as an empty string and are reported in `warnings`.

// An answer value as stored/normalized for prompt rendering. Image answers are
// represented as `{ imageId }`; everything else is a scalar or array of scalars.
export type PromptAnswer =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number>
  | { imageId: string };

export interface PromptContext {
  /** Computed profile fields, e.g. `{ targetWeight: 70, bmi: 27.7 }`. */
  profile: Record<string, string | number | null | undefined>;
  /** Answers keyed by `Question.key`. */
  answers: Record<string, PromptAnswer>;
  /** AI-extracted values keyed by `Question.key`, e.g. `{ lunch_photo: { calories: 650 } }` (CR-007). */
  derived?: Record<string, Record<string, unknown>>;
}

export interface VisionInput {
  questionKey: string;
  imageId: string;
}

export interface FilledPrompt {
  text: string;
  images: VisionInput[];
  /** Placeholders that could not be resolved (e.g. "q.missing"). */
  warnings: string[];
}

// Matches `{{ q.key }}`, `{{ q.key.field }}` (derived) and `{{ profile.field }}`
// with optional inner whitespace.
const PLACEHOLDER =
  /\{\{\s*(q|profile)\.([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?\s*\}\}/g;

function isImageAnswer(v: unknown): v is { imageId: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "imageId" in v &&
    typeof (v as { imageId: unknown }).imageId === "string"
  );
}

function renderScalar(v: PromptAnswer): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function fillPrompt(body: string, ctx: PromptContext): FilledPrompt {
  const images: VisionInput[] = [];
  const seenImageKeys = new Set<string>();
  const warnings: string[] = [];

  const text = body.replace(
    PLACEHOLDER,
    (_match, scope: string, key: string, field: string | undefined) => {
      if (scope === "profile") {
        const val = ctx.profile[key];
        if (val === undefined || val === null) {
          warnings.push(`profile.${key}`);
          return "";
        }
        return String(val);
      }

      // scope === "q"
      // Derived reference: {{q.<key>.<field>}} → AI-extracted value.
      if (field) {
        const val = ctx.derived?.[key]?.[field];
        if (val === undefined || val === null) {
          warnings.push(`q.${key}.${field}`);
          return "";
        }
        return renderScalar(val as PromptAnswer);
      }

      const answer = ctx.answers[key];
      if (answer === undefined) {
        warnings.push(`q.${key}`);
        return "";
      }
      if (isImageAnswer(answer)) {
        if (!seenImageKeys.has(key)) {
          seenImageKeys.add(key);
          images.push({ questionKey: key, imageId: answer.imageId });
        }
        // Labeled marker so multiple images stay distinguishable to the model;
        // the bytes go to the vision channel in the same order.
        return `[image: ${key}]`;
      }
      return renderScalar(answer);
    },
  );

  return { text, images, warnings };
}
