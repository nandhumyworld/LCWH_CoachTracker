import { describe, it, expect } from "vitest";
import {
  daysBetweenLocalDates,
  isSchedulableDate,
  MAX_SCHEDULE_DAYS_AHEAD,
} from "@/lib/gate-util";

describe("daysBetweenLocalDates", () => {
  it("counts whole calendar days from -> to", () => {
    expect(daysBetweenLocalDates("2026-08-18", "2026-08-18")).toBe(0);
    expect(daysBetweenLocalDates("2026-08-18", "2026-08-25")).toBe(7);
    expect(daysBetweenLocalDates("2026-08-18", "2026-08-17")).toBe(-1);
    // spans a month boundary
    expect(daysBetweenLocalDates("2026-08-31", "2026-09-01")).toBe(1);
  });
});

describe("isSchedulableDate", () => {
  const today = "2026-08-18";

  it("allows today through +7 days", () => {
    expect(isSchedulableDate(today, today)).toBe(true);
    expect(isSchedulableDate("2026-08-25", today)).toBe(true); // +7
  });

  it("rejects past dates", () => {
    expect(isSchedulableDate("2026-08-17", today)).toBe(false);
  });

  it("rejects dates more than a week ahead", () => {
    expect(isSchedulableDate("2026-08-26", today)).toBe(false); // +8
  });

  it("uses MAX_SCHEDULE_DAYS_AHEAD as the upper bound", () => {
    const maxDate = "2026-08-25";
    expect(daysBetweenLocalDates(today, maxDate)).toBe(MAX_SCHEDULE_DAYS_AHEAD);
    expect(isSchedulableDate(maxDate, today)).toBe(true);
  });
});
