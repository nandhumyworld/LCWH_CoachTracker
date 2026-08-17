import { describe, it, expect } from "vitest";
import { computeProfile } from "@/lib/profile";

describe("computeProfile", () => {
  it("computes BMI and weight-to-lose", () => {
    const p = computeProfile({
      heightCm: 170,
      currentWeightKg: 80,
      targetWeightKg: 70,
    });
    expect(p.bmi).toBeCloseTo(27.68, 1);
    expect(p.weightToLoseKg).toBe(10);
    expect(p.bmr).toBeGreaterThan(0);
  });

  it("floors weight-to-lose at 0 when already at/below target", () => {
    const p = computeProfile({
      heightCm: 170,
      currentWeightKg: 65,
      targetWeightKg: 70,
    });
    expect(p.weightToLoseKg).toBe(0);
  });

  it("classifies BMI category", () => {
    expect(
      computeProfile({ heightCm: 180, currentWeightKg: 55, targetWeightKg: 55 })
        .bmiCategory,
    ).toBe("underweight");
    expect(
      computeProfile({ heightCm: 170, currentWeightKg: 65, targetWeightKg: 60 })
        .bmiCategory,
    ).toBe("normal");
    expect(
      computeProfile({ heightCm: 170, currentWeightKg: 80, targetWeightKg: 70 })
        .bmiCategory,
    ).toBe("overweight");
    expect(
      computeProfile({ heightCm: 160, currentWeightKg: 90, targetWeightKg: 70 })
        .bmiCategory,
    ).toBe("obese");
  });
});
