import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudent } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { localDateToUtc } from "@/lib/daily-entry-util";
import { DailyForm, type FormQuestion } from "../../today/DailyForm";

// Read-only view of any past day and its report (FR-18).
export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { studentId, coachId } = await requireStudent();
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const entry = await prisma.dailyEntry.findUnique({
    where: { studentId_localDate: { studentId, localDate: localDateToUtc(date) } },
  });
  if (!entry) notFound();

  const [questions, answers, report] = await Promise.all([
    prisma.question.findMany({ where: { coachId }, orderBy: { orderIndex: "asc" } }),
    prisma.answer.findMany({ where: { dailyEntryId: entry.id } }),
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
        <Link href="/student" className="text-sm text-muted-foreground">
          ← Home
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{date}</h1>
        <p className="text-muted-foreground">Status: {entry.status}</p>
      </div>

      {report?.body && (
        <div className="rounded-md border p-4">
          <h2 className="mb-1 font-semibold">Your report</h2>
          <p className="whitespace-pre-wrap text-sm">{report.body}</p>
        </div>
      )}

      <DailyForm
        entryId={entry.id}
        status={entry.status}
        questions={formQuestions}
        submissionMessage=""
        reportStatus={report?.status ?? null}
      />
    </main>
  );
}
