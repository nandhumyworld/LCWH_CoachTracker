import { prisma } from "@/lib/db";
import { computeProfile } from "@/lib/profile";

// Persists the profile panel for a student from their intake numbers.
export async function writeProfilePanel(
  studentId: string,
  input: { heightCm: number; currentWeightKg: number; targetWeightKg: number },
): Promise<void> {
  const p = computeProfile(input);
  await prisma.profilePanel.upsert({
    where: { studentId },
    update: {
      bmi: p.bmi,
      bmr: p.bmr,
      weightToLoseKg: p.weightToLoseKg,
      computed: { bmiCategory: p.bmiCategory },
      generatedAt: new Date(),
    },
    create: {
      studentId,
      bmi: p.bmi,
      bmr: p.bmr,
      weightToLoseKg: p.weightToLoseKg,
      computed: { bmiCategory: p.bmiCategory },
    },
  });
}
