import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { getDefaultModel } from "@/lib/settings";
import { DEFAULT_PROMPT_BODY } from "@/lib/report";
import { PromptEditor } from "./PromptEditor";

// Profile fields exposed to the report prompt as {{profile.<field>}} — mirror
// the context built in generateReport (src/lib/report.ts).
const PROFILE_FIELDS = ["bmi", "bmr", "weightToLoseKg", "currentWeight", "targetWeight", "height"];

const DEFAULT_EXTRACTION_BODY =
  "You are a nutrition vision assistant. For each meal photo below, estimate its " +
  "calories and list the foods. Reply ONLY with JSON keyed by the image label, e.g. " +
  '{"lunch_photo": {"calories": 650, "items": ["rice","dal"]}}. No prose.';

// Admin prompt editors: the report prompt AND the image-extraction prompt
// (CR-007), each with its own body + OpenRouter model — no redeploy (NFR-1).
export default async function AdminPromptPage() {
  await requireRole("admin");

  const [reportTpl, extractionTpl, questions, fallbackModel] = await Promise.all([
    prisma.promptTemplate.findFirst({
      where: { kind: "report" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.promptTemplate.findFirst({
      where: { kind: "extraction" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.question.findMany({
      select: { key: true, prompt: true, type: true, allowsImage: true },
      orderBy: { orderIndex: "asc" },
    }),
    getDefaultModel(),
  ]);

  const seen = new Set<string>();
  const questionKeys = questions.filter((q) => {
    if (seen.has(q.key)) return false;
    seen.add(q.key);
    return true;
  });
  const imageKeys = questionKeys.filter((q) => q.type === "image" || q.allowsImage);

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-4">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Report prompt</h1>
          <p className="text-muted-foreground">
            Generates each student&apos;s daily report. Can reference extracted
            values with <code>{"{{q.<key>.calories}}"}</code>. Changes take effect
            immediately.
          </p>
        </div>
        <PromptEditor
          kind="report"
          id={reportTpl?.id ?? null}
          name={reportTpl?.name ?? "Daily report"}
          body={reportTpl?.body ?? DEFAULT_PROMPT_BODY}
          modelId={reportTpl?.modelId ?? fallbackModel}
          version={reportTpl?.version ?? null}
          questionKeys={questionKeys}
          profileFields={PROFILE_FIELDS}
        />
      </section>

      <section className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-2xl font-bold">Image extraction prompt</h2>
          <p className="text-muted-foreground">
            Runs first. The system automatically attaches every meal photo (each
            image question) <em>and its note</em>; a meal with no photo and no
            note is recorded as &quot;no meal logged&quot; without calling the
            model. Write the instructions + the required JSON format keyed by the
            question key (the labels below). Leave unset to skip extraction.
          </p>
        </div>
        <PromptEditor
          kind="extraction"
          id={extractionTpl?.id ?? null}
          name={extractionTpl?.name ?? "Image extraction"}
          body={extractionTpl?.body ?? DEFAULT_EXTRACTION_BODY}
          modelId={extractionTpl?.modelId ?? fallbackModel}
          version={extractionTpl?.version ?? null}
          questionKeys={imageKeys}
          profileFields={[]}
        />
      </section>
    </main>
  );
}
