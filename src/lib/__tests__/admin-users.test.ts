import { describe, it, expect } from "vitest";
import {
  createUserSchema,
  identitySchema,
  passwordSchema,
  studentProfileSchema,
  normalizeEmail,
  isValidTimezone,
  buildAuditDetails,
} from "@/lib/admin-users-util";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});

describe("createUserSchema", () => {
  it("accepts coach and admin roles", () => {
    expect(createUserSchema.safeParse({ name: "A", email: "a@b.com", role: "coach" }).success).toBe(true);
    expect(createUserSchema.safeParse({ name: "A", email: "a@b.com", role: "admin" }).success).toBe(true);
  });
  it("rejects student role and bad email", () => {
    expect(createUserSchema.safeParse({ name: "A", email: "a@b.com", role: "student" }).success).toBe(false);
    expect(createUserSchema.safeParse({ name: "A", email: "nope", role: "coach" }).success).toBe(false);
  });
});

describe("identitySchema", () => {
  it("requires a name and valid email", () => {
    expect(identitySchema.safeParse({ name: "", email: "a@b.com" }).success).toBe(false);
    expect(identitySchema.safeParse({ name: "A", email: "a@b.com" }).success).toBe(true);
  });
});

describe("passwordSchema", () => {
  it("rejects passwords under 8 chars", () => {
    expect(passwordSchema.safeParse({ password: "short" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "longenough" }).success).toBe(true);
  });
});

describe("studentProfileSchema", () => {
  const base = {
    timezone: "Asia/Kolkata",
    status: "active" as const,
    coachId: "c1",
    heightCm: 170,
    currentWeightKg: 80,
    targetWeightKg: 70,
  };
  it("accepts valid input", () => {
    expect(studentProfileSchema.safeParse(base).success).toBe(true);
  });
  it("rejects target above current", () => {
    expect(studentProfileSchema.safeParse({ ...base, targetWeightKg: 90 }).success).toBe(false);
  });
});

describe("isValidTimezone", () => {
  it("accepts known zones and rejects junk", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
  });
});

describe("buildAuditDetails", () => {
  it("returns only changed fields", () => {
    const d = buildAuditDetails(
      { name: "Old", email: "a@b.com" },
      { name: "New", email: "a@b.com" },
      ["name", "email"],
    );
    expect(d).toEqual({ name: { from: "Old", to: "New" } });
  });
  it("omits fields not present in the after object", () => {
    const d = buildAuditDetails({ name: "Old", email: "a@b.com" }, { name: "New" }, ["name", "email"]);
    expect(d).toEqual({ name: { from: "Old", to: "New" } });
  });
});
