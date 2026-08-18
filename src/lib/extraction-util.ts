// Pure helpers for image extraction (CR-007) — no Prisma/IO, unit-tested.

// Extracts a JSON object from a model response. Handles ```json fences and
// surrounding prose by taking the substring from the first `{` to the last `}`.
// Returns null when nothing parseable is found.
export function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;

  // Prefer a fenced ```json ... ``` block if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fence) candidates.push(fence[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export interface DerivedAssignment {
  answerId: string;
  derived: Record<string, unknown>;
}

// Maps a parsed extraction result to answer ids. The model is asked to key its
// output by question key; if it returns a flat object for a single analyzed
// image, that object is assigned to the one analyzed answer.
export function distributeDerived(
  parsed: Record<string, unknown>,
  answerIdByKey: Record<string, string>,
): DerivedAssignment[] {
  const keys = Object.keys(answerIdByKey);

  // Keyed shape: at least one top-level key matches an analyzed question key.
  const keyed = keys.filter(
    (k) => parsed[k] && typeof parsed[k] === "object" && !Array.isArray(parsed[k]),
  );
  if (keyed.length > 0) {
    return keyed.map((k) => ({
      answerId: answerIdByKey[k],
      derived: parsed[k] as Record<string, unknown>,
    }));
  }

  // Flat shape for exactly one analyzed image → assign to that answer.
  if (keys.length === 1) {
    return [{ answerId: answerIdByKey[keys[0]], derived: parsed }];
  }

  return [];
}
