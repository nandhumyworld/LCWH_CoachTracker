import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { QuestionBuilder, type QItem } from "./QuestionBuilder";

// Loads the coach's fixed daily question set and hands it to the client builder.
export default async function QuestionsPage() {
  const { coachId } = await requireCoach();
  const rows = await prisma.question.findMany({
    where: { coachId },
    orderBy: { orderIndex: "asc" },
  });

  const questions: QItem[] = rows.map((r) => ({
    id: r.id,
    key: r.key,
    sectionTitle: r.sectionTitle,
    orderIndex: r.orderIndex,
    type: r.type,
    prompt: r.prompt,
    options: (r.options ?? {}) as Record<string, unknown>,
    points: r.points,
    required: r.required,
    allowsImage: r.allowsImage,
    helpText: r.helpText ?? "",
  }));

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Daily questions</h1>
        <p className="text-muted-foreground">
          The fixed set every student answers each day. Use the key in report
          prompts as <code>{"{{q.key}}"}</code>.
        </p>
      </div>
      <QuestionBuilder initial={questions} />
    </main>
  );
}
