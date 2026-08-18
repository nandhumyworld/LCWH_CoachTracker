import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { DEFAULT_PROMPT_BODY } from "@/lib/report";
import { PromptEditor } from "./PromptEditor";

// Profile fields exposed to the prompt as {{profile.<field>}} — mirror the
// context built in generateReport (src/lib/report.ts).
const PROFILE_FIELDS = [
  "bmi",
  "bmr",
  "weightToLoseKg",
  "currentWeight",
  "targetWeight",
  "height",
];

// Admin prompt editor: edit the report prompt body + OpenRouter model with no
// redeploy (NFR-1, FR-26). Shows the placeholders available for the current
// question set.
export default async function AdminPromptPage() {
  await requireRole("admin");

  const [template, questions] = await Promise.all([
    prisma.promptTemplate.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.question.findMany({
      select: { key: true, prompt: true },
      orderBy: { orderIndex: "asc" },
    }),
  ]);

  // Distinct question keys (a key is unique per coach; MVP has one coach).
  const seen = new Set<string>();
  const questionKeys = questions.filter((q) => {
    if (seen.has(q.key)) return false;
    seen.add(q.key);
    return true;
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Report prompt</h1>
        <p className="text-muted-foreground">
          The prompt used to generate each student&apos;s daily AI report. Changes
          take effect immediately — no redeploy.
        </p>
      </div>

      <PromptEditor
        id={template?.id ?? null}
        name={template?.name ?? "Daily report"}
        body={template?.body ?? DEFAULT_PROMPT_BODY}
        modelId={template?.modelId ?? env.OPENROUTER_DEFAULT_MODEL}
        version={template?.version ?? null}
        questionKeys={questionKeys}
        profileFields={PROFILE_FIELDS}
      />
    </main>
  );
}
