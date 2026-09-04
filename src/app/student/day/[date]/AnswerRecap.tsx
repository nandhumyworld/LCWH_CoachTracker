import { formatDerived } from "@/lib/dashboard";
import type { FormQuestion } from "../../today/DailyForm";

// Read-only "Your answers" recap for a past day (server component). Groups the
// questions by section and shows each question with the student's answer —
// scalar/choice values, meal photos with the AI calorie line, and notes — so a
// submitted day shows what was actually answered, not just the report.
export function AnswerRecap({ questions }: { questions: FormQuestion[] }) {
  const sections = new Map<string, FormQuestion[]>();
  for (const q of questions) {
    if (!sections.has(q.sectionTitle)) sections.set(q.sectionTitle, []);
    sections.get(q.sectionTitle)!.push(q);
  }

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Your answers</h2>
      {[...sections.entries()].map(([section, qs]) => (
        <div key={section} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{section}</h3>
          <ul className="divide-y rounded-lg border">
            {qs.map((q) => (
              <li key={q.id} className="space-y-2 p-3">
                <p className="text-sm font-medium">{q.prompt}</p>
                <AnswerValue q={q} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function AnswerValue({ q }: { q: FormQuestion }) {
  const derivedLine = formatDerived(q.derived);
  const hasImage = Boolean(q.imageId);
  const scalar = renderScalar(q.value);

  // Meal / image question: show the photo + AI calorie line.
  if (q.type === "image" || hasImage) {
    return (
      <div className="space-y-1">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/images/${q.imageId}`}
            alt="answer"
            className="max-h-40 rounded-md border"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No photo.</p>
        )}
        {q.type !== "image" && scalar && <p className="text-sm">{scalar}</p>}
        {derivedLine && <p className="text-xs text-primary">AI: {derivedLine}</p>}
        {q.note && <NoteLine note={q.note} />}
      </div>
    );
  }

  // Everything else: the value (or "Not answered") plus any note.
  return (
    <div className="space-y-1">
      {scalar ? (
        <p className="text-sm">{scalar}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Not answered</p>
      )}
      {q.note && <NoteLine note={q.note} />}
    </div>
  );
}

function NoteLine({ note }: { note: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium">Note:</span> {note}
    </p>
  );
}

function renderScalar(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
