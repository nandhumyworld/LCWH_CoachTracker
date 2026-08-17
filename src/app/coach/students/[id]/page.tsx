import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { ProfilePanelCard } from "@/components/ProfilePanelCard";
import { RegenerateButton } from "./RegenerateButton";

// Minimal per-student view. The full daily history + reports arrive in Phase 8.
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

  const computed = (student.profilePanel?.computed ?? {}) as {
    bmiCategory?: string;
  };

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
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This student has not completed intake yet.
        </p>
      )}
    </main>
  );
}
