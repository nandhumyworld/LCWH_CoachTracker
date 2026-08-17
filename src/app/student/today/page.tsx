import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { getOrCreateTodayEntry } from "@/lib/daily-entry";
import { DailyForm, type FormQuestion } from "./DailyForm";

// Today's check-in: the coach's fixed question set for the student's current
// local date, pre-filled with any saved answers.
export default async function TodayPage() {
  const { studentId, coachId, intakeComplete } = await requireStudent();
  if (!intakeComplete) redirect("/student/intake");

  const entry = await getOrCreateTodayEntry(studentId);

  const [questions, answers, settings, report] = await Promise.all([
    prisma.question.findMany({ where: { coachId }, orderBy: { orderIndex: "asc" } }),
    prisma.answer.findMany({ where: { dailyEntryId: entry.id } }),
    prisma.programSettings.findUnique({ where: { coachId } }),
    prisma.report.findUnique({ where: { dailyEntryId: entry.id } }),
  ]);

  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  const formQuestions: FormQuestion[] = questions.map((q) => {
    const a = byQ.get(q.id);
    return {
      id: q.id,
      key: q.key,
      sectionTitle: q.sectionTitle,
      type: q.type,
      prompt: q.prompt,
      options: (q.options ?? {}) as Record<string, unknown>,
      required: q.required,
      allowsImage: q.allowsImage,
      helpText: q.helpText ?? "",
      value: a?.value ?? null,
      note: a?.note ?? "",
      imageId: a?.imageRefId ?? null,
    };
  });

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Today&apos;s check-in</h1>
        {settings?.formDescription && (
          <p className="text-muted-foreground">{settings.formDescription}</p>
        )}
      </div>
      <DailyForm
        entryId={entry.id}
        status={entry.status}
        questions={formQuestions}
        submissionMessage={settings?.submissionMessage ?? "Thanks — see you tomorrow!"}
        reportStatus={report?.status ?? null}
      />
    </main>
  );
}
