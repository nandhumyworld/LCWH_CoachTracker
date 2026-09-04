import { describe, it, expect } from "vitest";
import { parseClockOffsetMs, computeClockOffsetMs } from "@/lib/settings-util";

describe("parseClockOffsetMs", () => {
  it("defaults to 0 for missing or malformed values", () => {
    expect(parseClockOffsetMs(null)).toBe(0);
    expect(parseClockOffsetMs("")).toBe(0);
    expect(parseClockOffsetMs("abc")).toBe(0);
    expect(parseClockOffsetMs("1.5")).toBe(0);
  });

  it("parses signed integer milliseconds", () => {
    expect(parseClockOffsetMs("0")).toBe(0);
    expect(parseClockOffsetMs("86400000")).toBe(86_400_000);
    expect(parseClockOffsetMs(" -3600000 ")).toBe(-3_600_000);
  });
});

describe("computeClockOffsetMs", () => {
  it("returns the delta that makes real now read as the target", () => {
    const real = Date.UTC(2026, 8, 4, 12, 0, 0); // 2026-09-04T12:00:00Z
    const target = Date.UTC(2026, 8, 10, 12, 0, 0); // +6 days
    expect(computeClockOffsetMs(target, real)).toBe(6 * 24 * 60 * 60 * 1000);
  });

  it("supports moving backwards", () => {
    const real = Date.UTC(2026, 8, 4, 0, 0, 0);
    const target = Date.UTC(2026, 8, 3, 0, 0, 0);
    expect(computeClockOffsetMs(target, real)).toBe(-24 * 60 * 60 * 1000);
  });

  it("returns 0 for a non-finite target", () => {
    expect(computeClockOffsetMs(NaN, Date.now())).toBe(0);
  });
});
