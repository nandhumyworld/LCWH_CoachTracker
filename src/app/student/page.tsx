import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStudent } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { localDateFor } from "@/lib/day";
import { computeWeightProgress, sumAnsweredPoints } from "@/lib/progress";
import { pickWeight, todayStatusLabel, reportStatusLabel } from "@/lib/dashboard";
import { ProfilePanelCard } from "@/components/ProfilePanelCard";
import { StudentDatePicker } from "./StudentDatePicker";

// Student home: goal-oriented progress (CR-002), points (CR-001), profile panel,
// and browse-past-days (CR-003).
export default async function StudentHome() {
  const { user, studentId, intakeComplete } = await requireStudent();
  if (!intakeComplete) redirect("/student/intake");

  const [student, panel, entries] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: {
        currentWeightKg: true,
        targetWeightKg: true,
        timezone: true,
        intakeAt: true,
      },
    }),
    prisma.profilePanel.findUnique({ where: { studentId } }),
    prisma.dailyEntry.findMany({
      where: { studentId },
      orderBy: { localDate: "desc" },
      include: {
        report: { select: { status: true } },
        answers: {
          include: { question: { select: { key: true, type: true, points: true } } },
        },
      },
    }),
  ]);

  const computed = (panel?.computed ?? {}) as { bmiCategory?: string };

  // Points: sum of answered questions' points across every day (CR-001).
  const totalPoints = entries.reduce(
    (sum, e) =>
      sum +
      sumAnsweredPoints(
        e.answers.map((a) => ({
          points: a.question.points,
          value: a.value,
          imageRefId: a.imageRefId,
        })),
      ),
    0,
  );

  // Latest logged weight = most recent day that has a weight answer.
  let latestWeight: number | null = null;
  for (const e of entries) {
    const w = pickWeight(e.answers);
    if (w != null) {
      latestWeight = w;
      break;
    }
  }

  const progress =
    student?.currentWeightKg != null && student?.targetWeightKg != null
      ? computeWeightProgress({
          startWeightKg: student.currentWeightKg,
          targetWeightKg: student.targetWeightKg,
          latestWeightKg: latestWeight,
          intakeAt: student.intakeAt,
        })
      : null;

  const today = student ? localDateFor(student.timezone) : "";
  const recentDays = entries.slice(0, 14).map((e) => ({
    date: localDateFor("UTC", e.localDate),
    status: todayStatusLabel(e.status),
    report: reportStatusLabel(e.report?.status ?? null),
  }));

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hi {user.name}</h1>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {totalPoints} pts
        </div>
      </div>

      {progress && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">Your progress</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Latest weight" value={`${progress.latestWeightKg} kg`} />
            <Stat
              label="Reduced"
              value={`${progress.reducedKg > 0 ? "−" : progress.reducedKg < 0 ? "+" : ""}${Math.abs(progress.reducedKg)} kg`}
            />
            <Stat label="To go" value={`${progress.remainingKg} kg`} />
            <Stat label="Days in" value={`${progress.daysElapsed}`} />
          </div>
          {progress.pctToGoal != null && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {progress.reducedKg > 0 ? progress.reducedKg : 0} of {progress.goalKg} kg goal
                </span>
                <span>{progress.pctToGoal}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${progress.pctToGoal}%` }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      <ProfilePanelCard
        data={{
          bmi: panel?.bmi ?? null,
          bmr: panel?.bmr ?? null,
          weightToLoseKg: panel?.weightToLoseKg ?? null,
          bmiCategory: computed.bmiCategory,
          currentWeightKg: student?.currentWeightKg ?? null,
          targetWeightKg: student?.targetWeightKg ?? null,
        }}
      />

      <Link
        href="/student/today"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Go to today&apos;s check-in
      </Link>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Past days</h2>
          <StudentDatePicker max={today} />
        </div>
        {recentDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-ins yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {recentDays.map((d) => (
              <li key={d.date}>
                <Link
                  href={`/student/day/${d.date}`}
                  className="flex items-center justify-between p-3 text-sm hover:bg-muted/50"
                >
                  <span className="font-medium">{d.date}</span>
                  <span className="text-muted-foreground">
                    {d.status} · report: {d.report}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
