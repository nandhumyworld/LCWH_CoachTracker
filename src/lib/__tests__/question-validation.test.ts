import { describe, it, expect } from "vitest";
import { validateAnswerValue, optionsSchemaFor } from "@/lib/questions";
import type { QuestionLike } from "@/lib/questions";

const q = (partial: Partial<QuestionLike>): QuestionLike => ({
  type: "short_text",
  required: false,
  ...partial,
});

describe("required handling", () => {
  it("rejects empty required, allows empty optional", () => {
    expect(validateAnswerValue(q({ type: "short_text", required: true }), "").ok).toBe(false);
    expect(validateAnswerValue(q({ type: "short_text", required: true }), undefined).ok).toBe(false);
    expect(validateAnswerValue(q({ type: "short_text", required: false }), undefined).ok).toBe(true);
    expect(validateAnswerValue(q({ type: "checkboxes", required: true, options: { choices: ["a"] } }), []).ok).toBe(false);
  });
});

describe("number", () => {
  it("enforces exclusive gt and inclusive max, integer", () => {
    const gt0 = q({ type: "number", required: true, options: { gt: 0 } });
    expect(validateAnswerValue(gt0, 0).ok).toBe(false);
    expect(validateAnswerValue(gt0, 2).ok).toBe(true);
    const ranged = q({ type: "number", options: { min: 1, max: 5, integer: true } });
    expect(validateAnswerValue(ranged, 5).ok).toBe(true);
    expect(validateAnswerValue(ranged, 6).ok).toBe(false);
    expect(validateAnswerValue(ranged, 2.5).ok).toBe(false);
    expect(validateAnswerValue(ranged, "x").ok).toBe(false);
  });
});

describe("linear_scale", () => {
  it("bounds to [min,max] integers", () => {
    const scale = q({ type: "linear_scale", options: { min: 1, max: 5 } });
    expect(validateAnswerValue(scale, 6).ok).toBe(false);
    expect(validateAnswerValue(scale, 0).ok).toBe(false);
    expect(validateAnswerValue(scale, 3).ok).toBe(true);
  });
});

describe("multiple_choice / checkboxes", () => {
  const choices = ["Yes", "No", "Maybe"];
  it("single-select must be one option", () => {
    const mc = q({ type: "multiple_choice", options: { choices } });
    expect(validateAnswerValue(mc, "Yes").ok).toBe(true);
    expect(validateAnswerValue(mc, "Nope").ok).toBe(false);
  });
  it("checkboxes must be a subset", () => {
    const cb = q({ type: "checkboxes", options: { choices } });
    expect(validateAnswerValue(cb, ["Yes", "No"]).ok).toBe(true);
    expect(validateAnswerValue(cb, ["Yes", "X"]).ok).toBe(false);
  });
});

describe("date", () => {
  it("requires an ISO-parseable date", () => {
    expect(validateAnswerValue(q({ type: "date" }), "2026-08-17").ok).toBe(true);
    expect(validateAnswerValue(q({ type: "date" }), "not-a-date").ok).toBe(false);
  });
});

describe("image", () => {
  it("required image needs a ref present", () => {
    const img = q({ type: "image", required: true });
    expect(validateAnswerValue(img, undefined).ok).toBe(false);
    expect(validateAnswerValue(img, "storedimage_123").ok).toBe(true);
  });
});

describe("optionsSchemaFor", () => {
  it("validates a linear_scale config (min < max)", () => {
    expect(optionsSchemaFor("linear_scale").safeParse({ min: 1, max: 5 }).success).toBe(true);
    expect(optionsSchemaFor("linear_scale").safeParse({ min: 5, max: 1 }).success).toBe(false);
  });
  it("requires non-empty choices for multiple_choice", () => {
    expect(optionsSchemaFor("multiple_choice").safeParse({ choices: ["a"] }).success).toBe(true);
    expect(optionsSchemaFor("multiple_choice").safeParse({ choices: [] }).success).toBe(false);
  });
});
