import { describe, it, expect } from "vitest";
import {
  todayStatusLabel,
  reportStatusLabel,
  pickWeight,
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
});
