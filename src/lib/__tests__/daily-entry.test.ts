import { describe, it, expect } from "vitest";
import { canEditEntry, localDateToUtc } from "@/lib/daily-entry-util";

describe("canEditEntry", () => {
  it("only an open entry is editable", () => {
    expect(canEditEntry("open")).toBe(true);
    expect(canEditEntry("submitted")).toBe(false);
    expect(canEditEntry("auto_submitted")).toBe(false);
    expect(canEditEntry("missed")).toBe(false);
  });
});

describe("localDateToUtc", () => {
  it("maps a YYYY-MM-DD to that date at UTC midnight", () => {
    const d = localDateToUtc("2026-08-17");
    expect(d.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });
});
