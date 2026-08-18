import { describe, it, expect } from "vitest";
import { hasRole, homePathForRole } from "@/lib/auth-helpers";

describe("hasRole", () => {
  it("checks role membership", () => {
    expect(hasRole("coach", ["coach", "admin"])).toBe(true);
    expect(hasRole("student", ["coach"])).toBe(false);
    expect(hasRole(undefined, ["coach"])).toBe(false);
  });
});

describe("homePathForRole", () => {
  it("routes each role to its area", () => {
    expect(homePathForRole("admin")).toBe("/admin");
    expect(homePathForRole("coach")).toBe("/coach");
    expect(homePathForRole("student")).toBe("/student");
  });
});
