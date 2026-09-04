// Deterministic daily-intake math (pure — no Prisma/IO, unit-tested).
//
// Calorie totals must be exact, so they are computed here rather than left to
// the LLM (small models add unreliably). Meal calories come from the AI
// extraction (Answer.derived.calories); each meal-replacement shake the client
// took counts as a fixed calorie + protein amount.

/** Fixed nutrition for one meal-replacement shake. */
export const SHAKE_KCAL = 200;
export const SHAKE_PROTEIN_G = 20;

// A shake question is "taken" when its answer is Yes (case-insensitive).
export function isYes(v: unknown): boolean {
  return typeof v === "string" && v.trim().toLowerCase() === "yes";
}

export interface IntakeSummary {
  /** Sum of the meal calorie estimates. */
  mealCalories: number;
  /** How many shakes were answered "Yes". */
  shakesTaken: number;
  /** shakesTaken × SHAKE_KCAL. */
  shakeCalories: number;
  /** shakesTaken × SHAKE_PROTEIN_G. */
  shakeProteinG: number;
  /** mealCalories + shakeCalories — the exact total to report. */
  totalCalories: number;
}

export function summarizeIntake(args: {
  mealCalories: Array<number | undefined | null>;
  shakeAnswers: unknown[];
}): IntakeSummary {
  const mealCalories = args.mealCalories.reduce<number>(
    (sum, c) => sum + (typeof c === "number" && Number.isFinite(c) ? c : 0),
    0,
  );
  const shakesTaken = args.shakeAnswers.filter(isYes).length;
  const shakeCalories = shakesTaken * SHAKE_KCAL;
  const shakeProteinG = shakesTaken * SHAKE_PROTEIN_G;
  return {
    mealCalories,
    shakesTaken,
    shakeCalories,
    shakeProteinG,
    totalCalories: mealCalories + shakeCalories,
  };
}
