import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { ProfilePanelCard } from "@/components/ProfilePanelCard";

// Student home. Gates on intake completion, then shows the profile panel.
// The daily check-in and gate popup arrive in Phases 4 and 7.
export default async function StudentHome() {
  const { user, studentId, intakeComplete } = await requireStudent();
  if (!intakeComplete) redirect("/student/intake");

  const [student, panel] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { currentWeightKg: true, targetWeightKg: true, timezone: true },
    }),
    prisma.profilePanel.findUnique({ where: { studentId } }),
  ]);

  const computed = (panel?.computed ?? {}) as { bmiCategory?: string };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hi {user.name}</h1>
        <p className="text-muted-foreground">Timezone: {student?.timezone}</p>
      </div>

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

      <p className="text-sm text-muted-foreground">
        Your daily check-in will appear here (coming in the next phase).
      </p>
    </main>
  );
}
