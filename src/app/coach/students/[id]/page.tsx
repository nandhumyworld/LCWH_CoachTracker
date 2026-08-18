import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { localDateFor } from "@/lib/day";
import { todayStatusLabel, reportStatusLabel } from "@/lib/dashboard";
import { ProfilePanelCard } from "@/components/ProfilePanelCard";
import { RegenerateButton } from "./RegenerateButton";

// Formats a stored answer value for read-only display.
function formatValue(value: unknown, imageRefId: string | null): string | null {
  if (imageRefId) return null; // rendered as an image instead
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

// Coach view of one student: profile panel + full daily history (answers +
// report per day, read-only) (spec §9, FR-31).
export default async function CoachStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { coachId } = await requireCoach();
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      profilePanel: true,
    },
  });
  if (!student || student.coachId !== coachId) notFound();

  const entries = await prisma.dailyEntry.findMany({
    where: { studentId: id },
    orderBy: { localDate: "desc" },
    include: {
      report: { select: { status: true, body: true } },
      answers: { include: { question: { select: { id: true, prompt: true } } } },
    },
  });

  const computed = (student.profilePanel?.computed ?? {}) as { bmiCategory?: string };

  return (
    <main className="space-y-6">
      <div>
        <Link href="/coach/students" className="text-sm text-muted-foreground">
          ← Students
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{student.user.name}</h1>
        <p className="text-muted-foreground">
          {student.user.email} · {student.status} · {student.timezone}
        </p>
      </div>

      {student.intakeAt ? (
        <>
          <ProfilePanelCard
            data={{
              bmi: student.profilePanel?.bmi ?? null,
              bmr: student.profilePanel?.bmr ?? null,
              weightToLoseKg: student.profilePanel?.weightToLoseKg ?? null,
              bmiCategory: computed.bmiCategory,
              currentWeightKg: student.currentWeightKg,
              targetWeightKg: student.targetWeightKg,
            }}
          />
          <RegenerateButton studentId={student.id} />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Daily history</h2>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No check-ins yet.</p>
            ) : (
              entries.map((entry) => (
                <details key={entry.id} className="rounded-lg border p-4">
                  <summary className="cursor-pointer font-medium">
                    {localDateFor("UTC", entry.localDate)}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {todayStatusLabel(entry.status)} · report:{" "}
                      {reportStatusLabel(entry.report?.status ?? null)}
                    </span>
                  </summary>

                  <div className="mt-3 space-y-3">
                    {entry.report?.body && (
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                          Report
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{entry.report.body}</p>
                      </div>
                    )}
                    <dl className="space-y-2 text-sm">
                      {entry.answers.length === 0 ? (
                        <p className="text-muted-foreground">No answers recorded.</p>
                      ) : (
                        entry.answers.map((a) => {
                          const text = formatValue(a.value, a.imageRefId);
                          return (
                            <div key={a.id}>
                              <dt className="text-muted-foreground">{a.question.prompt}</dt>
                              <dd>
                                {a.imageRefId ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={`/api/images/${a.imageRefId}`}
                                    alt={a.question.prompt}
                                    className="mt-1 max-h-48 rounded-md object-contain"
                                  />
                                ) : (
                                  <span>{text}</span>
                                )}
                                {a.note && (
                                  <span className="ml-2 text-muted-foreground">({a.note})</span>
                                )}
                              </dd>
                            </div>
                          );
                        })
                      )}
                    </dl>
                  </div>
                </details>
              ))
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This student has not completed intake yet.
        </p>
      )}
    </main>
  );
}
