import Link from "next/link";
import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

// Coach home. The full all-student dashboard arrives in Phase 8; for now this
// surfaces quick counts and links into the program builder.
export default async function CoachHome() {
  const { user, coachId } = await requireCoach();
  const [questionCount, studentCount] = await Promise.all([
    prisma.question.count({ where: { coachId } }),
    prisma.student.count({ where: { coachId } }),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <p className="text-muted-foreground">
          {questionCount} question{questionCount === 1 ? "" : "s"} · {studentCount}{" "}
          student{studentCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/coach/questions"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Build daily questions
        </Link>
        <Link
          href="/coach/settings"
          className="rounded-md border px-4 py-2 text-sm"
        >
          Form settings
        </Link>
      </div>
    </main>
  );
}
