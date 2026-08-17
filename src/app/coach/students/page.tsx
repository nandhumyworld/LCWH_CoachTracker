import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { StudentsManager, type StudentRow } from "./StudentsManager";

// Coach roster: invite students and see their status.
export default async function StudentsPage() {
  const { coachId } = await requireCoach();
  const rows = await prisma.student.findMany({
    where: { coachId },
    orderBy: { joinedDate: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const students: StudentRow[] = rows.map((s) => ({
    id: s.id,
    name: s.user.name,
    email: s.user.email,
    status: s.status,
    timezone: s.timezone,
    intakeComplete: s.intakeAt !== null,
  }));

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Students</h1>
        <p className="text-muted-foreground">
          Invite a student, then share their one-time set-password link.
        </p>
      </div>
      <StudentsManager initial={students} />
    </main>
  );
}
