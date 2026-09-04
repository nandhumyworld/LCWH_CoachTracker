// Deterministic profile-panel computation from intake data.
//
// NOTE: Mifflin–St Jeor BMR needs age and sex, which the MVP intake does not
// capture (spec FR-3 collects only timezone/height/weight/target). We therefore
// compute BMR with documented placeholder assumptions (age 30, female
// constant). This yields a reasonable, positive estimate; when intake later
// captures age/sex, pass them in and the estimate becomes exact.

export interface ProfileInput {
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  ageYears?: number;
  sex?: "male" | "female";
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export interface ComputedProfile {
  bmi: number;
  bmiCategory: BmiCategory;
  bmr: number;
  weightToLoseKg: number;
}

const DEFAULT_AGE = 30;
const DEFAULT_SEX: "male" | "female" = "female";

function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function computeProfile(input: ProfileInput): ComputedProfile {
  const heightM = input.heightCm / 100;
  const bmi = input.currentWeightKg / (heightM * heightM);

  const age = input.ageYears ?? DEFAULT_AGE;
  const sex = input.sex ?? DEFAULT_SEX;
  // Mifflin–St Jeor
  const sexConstant = sex === "male" ? 5 : -161;
  const bmr =
    10 * input.currentWeightKg + 6.25 * input.heightCm - 5 * age + sexConstant;

  const weightToLoseKg = Math.max(
    0,
    input.currentWeightKg - input.targetWeightKg,
  );

  return {
    bmi: Math.round(bmi * 100) / 100,
    bmiCategory: bmiCategory(bmi),
    bmr: Math.round(bmr),
    weightToLoseKg: Math.round(weightToLoseKg * 100) / 100,
  };
}
