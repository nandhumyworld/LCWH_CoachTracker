import { describe, it, expect } from "vitest";
import { parseRetentionDays, SETTING_KEYS } from "@/lib/settings-util";

describe("parseRetentionDays", () => {
  it("returns a valid positive integer from the stored string", () => {
    expect(parseRetentionDays("45", 30)).toBe(45);
  });

  it("falls back when the value is missing", () => {
    expect(parseRetentionDays(null, 30)).toBe(30);
    expect(parseRetentionDays("", 30)).toBe(30);
  });

  it("falls back on non-numeric or non-positive values", () => {
    expect(parseRetentionDays("abc", 30)).toBe(30);
    expect(parseRetentionDays("0", 30)).toBe(30);
    expect(parseRetentionDays("-5", 30)).toBe(30);
    expect(parseRetentionDays("12.5", 30)).toBe(30);
  });
});

describe("SETTING_KEYS", () => {
  it("exposes the known setting keys", () => {
    expect(SETTING_KEYS.photoRetentionDays).toBe("photo_retention_days");
    expect(SETTING_KEYS.openrouterDefaultModel).toBe("openrouter_default_model");
  });
});
