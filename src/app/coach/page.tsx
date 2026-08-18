import Link from "next/link";
import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { localDateFor } from "@/lib/day";
import { localDateToUtc } from "@/lib/daily-entry-util";
import { todayStatusLabel, reportStatusLabel, pickWeight } from "@/lib/dashboard";

// Coach home: every student with today's check-in status, report status, and
// latest logged weight (spec §9, FR-31). "Today" is each student's local date.
export default async function CoachHome() {
  const { user, coachId } = await requireCoach();
  const now = new Date();

  const students = await prisma.student.findMany({
    where: { coachId },
    orderBy: { joinedDate: "desc" },
    include: { user: { select: { name: true } } },
  });

  const rows = await Promise.all(
    students.map(async (s) => {
      const localDate = localDateFor(s.timezone, now);
      const entry = await prisma.dailyEntry.findUnique({
        where: {
          studentId_localDate: { studentId: s.id, localDate: localDateToUtc(localDate) },
        },
        include: {
          report: { select: { status: true } },
          answers: { include: { question: { select: { key: true, type: true } } } },
        },
      });
      const weight = entry ? pickWeight(entry.answers) : null;
      return {
        id: s.id,
        name: s.user.name,
        status: s.status,
        localDate,
        entryStatusLabel: todayStatusLabel(entry?.status ?? null),
        reportLabel: reportStatusLabel(entry?.report?.status ?? null),
        weight: weight ?? s.currentWeightKg ?? null,
      };
    }),
  );

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <p className="text-muted-foreground">
          {students.length} student{students.length === 1 ? "" : "s"} · today&apos;s
          check-ins
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No students yet.{" "}
          <Link href="/coach/students" className="underline">
            Invite one
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Today ({"local"})</th>
                <th className="p-3 font-medium">Report</th>
                <th className="p-3 font-medium">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3">
                    <Link href={`/coach/students/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    {r.status !== "active" && (
                      <span className="ml-2 text-xs text-muted-foreground">({r.status})</span>
                    )}
                  </td>
                  <td className="p-3">{r.entryStatusLabel}</td>
                  <td className="p-3">{r.reportLabel}</td>
                  <td className="p-3">{r.weight != null ? `${r.weight} kg` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/coach/questions" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Build daily questions
        </Link>
        <Link href="/coach/attendance" className="rounded-md border px-4 py-2 text-sm">
          Attendance
        </Link>
      </div>
    </main>
  );
}
