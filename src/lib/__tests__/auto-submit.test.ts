import { describe, it, expect } from "vitest";
import {
  finalStatusForAutoSubmit,
  dbDateToLocalDateString,
} from "@/lib/auto-submit-util";

describe("finalStatusForAutoSubmit", () => {
  it("is missed when nothing was entered, else auto_submitted", () => {
    expect(finalStatusForAutoSubmit(0)).toBe("missed");
    expect(finalStatusForAutoSubmit(1)).toBe("auto_submitted");
    expect(finalStatusForAutoSubmit(5)).toBe("auto_submitted");
  });
});

describe("dbDateToLocalDateString", () => {
  it("renders a @db.Date as its YYYY-MM-DD calendar date", () => {
    expect(dbDateToLocalDateString(new Date("2026-08-17T00:00:00.000Z"))).toBe(
      "2026-08-17",
    );
  });
});
