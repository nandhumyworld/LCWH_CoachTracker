import { describe, it, expect } from "vitest";
import {
  isYes,
  summarizeIntake,
  SHAKE_KCAL,
  SHAKE_PROTEIN_G,
} from "@/lib/intake-util";

describe("isYes", () => {
  it("matches Yes case-insensitively, trimmed", () => {
    expect(isYes("Yes")).toBe(true);
    expect(isYes(" yes ")).toBe(true);
    expect(isYes("YES")).toBe(true);
  });
  it("treats No/blank/other as not yes", () => {
    expect(isYes("No")).toBe(false);
    expect(isYes("")).toBe(false);
    expect(isYes(null)).toBe(false);
    expect(isYes(undefined)).toBe(false);
    expect(isYes(123)).toBe(false);
  });
});

describe("summarizeIntake", () => {
  it("sums meal calories and adds fixed kcal/protein per shake taken", () => {
    const s = summarizeIntake({
      mealCalories: [450, 0, 350],
      shakeAnswers: ["Yes", "Yes"],
    });
    expect(s.mealCalories).toBe(800);
    expect(s.shakesTaken).toBe(2);
    expect(s.shakeCalories).toBe(2 * SHAKE_KCAL); // 400
    expect(s.shakeProteinG).toBe(2 * SHAKE_PROTEIN_G); // 40
    expect(s.totalCalories).toBe(1200);
  });

  it("counts only shakes answered Yes", () => {
    const s = summarizeIntake({
      mealCalories: [500],
      shakeAnswers: ["Yes", "No", ""],
    });
    expect(s.shakesTaken).toBe(1);
    expect(s.shakeCalories).toBe(200);
    expect(s.totalCalories).toBe(700);
  });

  it("ignores non-numeric meal calories (treats as 0)", () => {
    const s = summarizeIntake({
      mealCalories: [300, NaN, undefined as unknown as number, 200],
      shakeAnswers: [],
    });
    expect(s.mealCalories).toBe(500);
    expect(s.totalCalories).toBe(500);
    expect(s.shakesTaken).toBe(0);
  });

  it("handles a fully empty day", () => {
    const s = summarizeIntake({ mealCalories: [], shakeAnswers: [] });
    expect(s).toEqual({
      mealCalories: 0,
      shakesTaken: 0,
      shakeCalories: 0,
      shakeProteinG: 0,
      totalCalories: 0,
    });
  });
});
