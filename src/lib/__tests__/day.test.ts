import { describe, it, expect } from "vitest";
import { localDateFor, isPastLocalCutoff } from "@/lib/day";

describe("localDateFor", () => {
  it("derives the local calendar date in a timezone", () => {
    // 2026-08-17T19:00Z == 2026-08-18 00:30 IST
    expect(localDateFor("Asia/Kolkata", new Date("2026-08-17T19:00:00Z"))).toBe("2026-08-18");
    // same instant is still 2026-08-17 in UTC
    expect(localDateFor("UTC", new Date("2026-08-17T19:00:00Z"))).toBe("2026-08-17");
    // New York is behind UTC
    expect(localDateFor("America/New_York", new Date("2026-08-17T03:00:00Z"))).toBe("2026-08-16");
  });
});

describe("isPastLocalCutoff", () => {
  const tz = "Asia/Kolkata";
  it("is false before 23:59 local and true after", () => {
    // 18:00Z = 23:30 IST -> before cutoff for 2026-08-17
    expect(isPastLocalCutoff(tz, "2026-08-17", new Date("2026-08-17T18:00:00Z"))).toBe(false);
    // 18:35Z = 00:05 IST next day -> after cutoff for 2026-08-17
    expect(isPastLocalCutoff(tz, "2026-08-17", new Date("2026-08-17T18:35:00Z"))).toBe(true);
  });
  it("is true for any earlier local date", () => {
    expect(isPastLocalCutoff(tz, "2026-08-16", new Date("2026-08-17T18:00:00Z"))).toBe(true);
  });
  it("is false for a future local date", () => {
    expect(isPastLocalCutoff(tz, "2026-08-18", new Date("2026-08-17T18:35:00Z"))).toBe(false);
  });
});
