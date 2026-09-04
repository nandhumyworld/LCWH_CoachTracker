// Pure helpers for the goal-oriented student dashboard (CR-001, CR-002) — no
// Prisma import, unit-tested. The page loads the data and calls these.

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface WeightProgressInput {
  startWeightKg: number; // weight at intake (Student.currentWeightKg)
  targetWeightKg: number;
  latestWeightKg: number | null; // most recent logged weight, or null
  intakeAt: Date | null;
  now?: Date;
}

export interface WeightProgress {
  startWeightKg: number;
  latestWeightKg: number;
  targetWeightKg: number;
  reducedKg: number; // start - latest (negative = gained)
  goalKg: number; // total to lose (start - target), floored at 0
  remainingKg: number; // latest - target, floored at 0
  daysElapsed: number; // whole days since intake
  pctToGoal: number | null; // 0..100, null when goal is non-positive
}

// Weight progress toward the target since intake (CR-002).
export function computeWeightProgress(input: WeightProgressInput): WeightProgress {
  const now = input.now ?? new Date();
  const latest = input.latestWeightKg ?? input.startWeightKg;
  const reducedKg = round1(input.startWeightKg - latest);
  const goalKg = Math.max(0, round1(input.startWeightKg - input.targetWeightKg));
  const remainingKg = Math.max(0, round1(latest - input.targetWeightKg));

  const daysElapsed = input.intakeAt
    ? Math.max(0, Math.floor((now.getTime() - input.intakeAt.getTime()) / 86_400_000))
    : 0;

  const pctToGoal =
    goalKg > 0 ? Math.min(100, Math.max(0, Math.round((reducedKg / goalKg) * 100))) : null;

  return {
    startWeightKg: input.startWeightKg,
    latestWeightKg: latest,
    targetWeightKg: input.targetWeightKg,
    reducedKg,
    goalKg,
    remainingKg,
    daysElapsed,
    pctToGoal,
  };
}

// Whether an answer counts as "answered" (has a non-empty value or an image).
export function isAnswered(value: unknown, imageRefId: string | null): boolean {
  if (imageRefId) return true;
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

interface PointsItem {
  points: number;
  value: unknown;
  imageRefId: string | null;
}

// Total points earned = sum of each answered question's points (CR-001).
export function sumAnsweredPoints(items: PointsItem[]): number {
  return items.reduce(
    (sum, it) => (isAnswered(it.value, it.imageRefId) ? sum + it.points : sum),
    0,
  );
}
