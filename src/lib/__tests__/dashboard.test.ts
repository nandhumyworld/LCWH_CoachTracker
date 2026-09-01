import { describe, it, expect } from "vitest";
import {
  todayStatusLabel,
  reportStatusLabel,
  pickWeight,
  formatDerived,
} from "@/lib/dashboard";

describe("todayStatusLabel", () => {
  it("labels each entry status, with null = not started", () => {
    expect(todayStatusLabel(null)).toBe("Not started");
    expect(todayStatusLabel("open")).toBe("In progress");
    expect(todayStatusLabel("submitted")).toBe("Submitted");
    expect(todayStatusLabel("auto_submitted")).toBe("Auto-submitted");
    expect(todayStatusLabel("missed")).toBe("Missed");
  });
});

describe("reportStatusLabel", () => {
  it("labels report status, with null = dash", () => {
    expect(reportStatusLabel(null)).toBe("—");
    expect(reportStatusLabel("pending")).toBe("Generating…");
    expect(reportStatusLabel("done")).toBe("Ready");
    expect(reportStatusLabel("failed")).toBe("Failed");
  });
});

describe("pickWeight", () => {
  const answers = [
    { question: { key: "weight", type: "number" }, value: 78 },
    { question: { key: "mood", type: "linear_scale" }, value: 4 },
  ];

  it("returns the numeric value of the weight question", () => {
    expect(pickWeight(answers)).toBe(78);
  });

  it("returns null when there is no weight answer", () => {
    expect(pickWeight([{ question: { key: "mood", type: "linear_scale" }, value: 4 }])).toBeNull();
  });

  it("ignores a non-numeric weight value", () => {
    expect(pickWeight([{ question: { key: "weight", type: "number" }, value: "n/a" }])).toBeNull();
  });

  it("honors a custom weight key", () => {
    expect(
      pickWeight([{ question: { key: "body_weight", type: "number" }, value: 80 }], "body_weight"),
    ).toBe(80);
  });

  it("finds the daily weight under the today_weight key by default", () => {
    expect(
      pickWeight([{ question: { key: "today_weight", type: "number" }, value: 74 }]),
    ).toBe(74);
  });

  it("prefers today_weight over a legacy weight answer", () => {
    expect(
      pickWeight([
        { question: { key: "weight", type: "number" }, value: 80 },
        { question: { key: "today_weight", type: "number" }, value: 74 },
      ]),
    ).toBe(74);
  });

  it("accepts a list of candidate keys, first match wins", () => {
    expect(
      pickWeight([{ question: { key: "weight", type: "number" }, value: 80 }], [
        "today_weight",
        "weight",
      ]),
    ).toBe(80);
  });
});

describe("formatDerived", () => {
  it("summarizes calories + items", () => {
    expect(formatDerived({ calories: 650, items: ["rice", "dal"] })).toBe(
      "≈650 kcal · rice, dal",
    );
  });
  it("includes other scalar fields", () => {
    expect(formatDerived({ protein: "20g" })).toBe("protein: 20g");
  });
  it("shows 'No meal logged' for a skipped meal", () => {
    expect(formatDerived({ skipped: true, status: "no meal logged", calories: 0 })).toBe(
      "No meal logged",
    );
  });
  it("returns null for empty/invalid input", () => {
    expect(formatDerived(null)).toBeNull();
    expect(formatDerived({})).toBeNull();
    expect(formatDerived("nope")).toBeNull();
  });
});
