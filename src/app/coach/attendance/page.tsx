import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { localDateFor } from "@/lib/day";
import { getNow } from "@/lib/clock";
import { localDateToUtc } from "@/lib/daily-entry-util";
import { formatInTimeZone } from "date-fns-tz";
import { AttendanceDatePicker } from "./AttendanceDatePicker";

// Per-date attendance: who acknowledged the day's gate message and when
// (spec §8, FR-25). Defaults to today with a date picker.
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { coachId } = await requireCoach();
  const { date: dateParam } = await searchParams;
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : localDateFor("UTC", await getNow());

  const [gate, students] = await Promise.all([
    prisma.dailyGateMessage.findUnique({
      where: { coachId_scheduledDate: { coachId, scheduledDate: localDateToUtc(date) } },
      include: {
        acknowledgements: { select: { studentId: true, acknowledgedAt: true } },
      },
    }),
    prisma.student.findMany({
      where: { coachId },
      orderBy: { joinedDate: "desc" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const ackByStudent = new Map(
    (gate?.acknowledgements ?? []).map((a) => [a.studentId, a.acknowledgedAt]),
  );
  const ackedCount = ackByStudent.size;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted-foreground">
          Who acknowledged the daily message on a given date.
        </p>
      </div>

      <AttendanceDatePicker date={date} />

      {!gate ? (
        <p className="text-sm text-muted-foreground">
          No daily message was scheduled for {date}.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {ackedCount} of {students.length} acknowledged.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Student</th>
                  <th className="p-3 font-medium">Acknowledged</th>
                  <th className="p-3 font-medium">At</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((s) => {
                  const at = ackByStudent.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="p-3 font-medium">{s.user.name}</td>
                      <td className="p-3">{at ? "✓ Yes" : "—"}</td>
                      <td className="p-3 text-muted-foreground">
                        {at ? formatInTimeZone(at, s.timezone, "HH:mm") : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
