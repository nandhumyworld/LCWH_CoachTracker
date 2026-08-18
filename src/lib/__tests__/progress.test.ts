import { describe, it, expect } from "vitest";
import {
  computeWeightProgress,
  isAnswered,
  sumAnsweredPoints,
} from "@/lib/progress";

describe("computeWeightProgress", () => {
  it("computes reduced / goal / remaining / days / pct", () => {
    const p = computeWeightProgress({
      startWeightKg: 80,
      targetWeightKg: 70,
      latestWeightKg: 76,
      intakeAt: new Date("2026-08-08T00:00:00Z"),
      now: new Date("2026-08-18T00:00:00Z"),
    });
    expect(p.reducedKg).toBe(4);
    expect(p.goalKg).toBe(10);
    expect(p.remainingKg).toBe(6);
    expect(p.daysElapsed).toBe(10);
    expect(p.pctToGoal).toBe(40);
  });

  it("handles weight gain (negative reduced, pct floored at 0)", () => {
    const p = computeWeightProgress({
      startWeightKg: 80,
      targetWeightKg: 70,
      latestWeightKg: 82,
      intakeAt: new Date("2026-08-17T00:00:00Z"),
      now: new Date("2026-08-18T00:00:00Z"),
    });
    expect(p.reducedKg).toBe(-2);
    expect(p.remainingKg).toBe(12);
    expect(p.pctToGoal).toBe(0);
  });

  it("falls back to start weight when there is no latest weigh-in", () => {
    const p = computeWeightProgress({
      startWeightKg: 80,
      targetWeightKg: 70,
      latestWeightKg: null,
      intakeAt: new Date("2026-08-18T00:00:00Z"),
      now: new Date("2026-08-18T00:00:00Z"),
    });
    expect(p.reducedKg).toBe(0);
    expect(p.daysElapsed).toBe(0);
  });

  it("returns null pct when the goal is non-positive (target >= start)", () => {
    const p = computeWeightProgress({
      startWeightKg: 70,
      targetWeightKg: 70,
      latestWeightKg: 70,
      intakeAt: new Date("2026-08-18T00:00:00Z"),
      now: new Date("2026-08-18T00:00:00Z"),
    });
    expect(p.pctToGoal).toBeNull();
  });

  it("treats a null intake date as 0 days elapsed", () => {
    const p = computeWeightProgress({
      startWeightKg: 80,
      targetWeightKg: 70,
      latestWeightKg: 78,
      intakeAt: null,
      now: new Date("2026-08-18T00:00:00Z"),
    });
    expect(p.daysElapsed).toBe(0);
  });
});

describe("isAnswered", () => {
  it("is true for a non-empty scalar/array or an attached image", () => {
    expect(isAnswered(5, null)).toBe(true);
    expect(isAnswered("hi", null)).toBe(true);
    expect(isAnswered(["a"], null)).toBe(true);
    expect(isAnswered(null, "img_1")).toBe(true);
  });
  it("is false for empty values with no image", () => {
    expect(isAnswered(null, null)).toBe(false);
    expect(isAnswered("", null)).toBe(false);
    expect(isAnswered([], null)).toBe(false);
    expect(isAnswered(undefined, null)).toBe(false);
  });
});

describe("sumAnsweredPoints", () => {
  it("sums points only for answered questions", () => {
    const total = sumAnsweredPoints([
      { points: 10, value: 78, imageRefId: null },
      { points: 5, value: "", imageRefId: null }, // unanswered
      { points: 3, value: null, imageRefId: "img_1" }, // answered via image
      { points: 0, value: 4, imageRefId: null },
    ]);
    expect(total).toBe(13);
  });
});
