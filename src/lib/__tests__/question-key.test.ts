import { describe, it, expect } from "vitest";
import { toKey } from "@/lib/questions";

describe("toKey", () => {
  it("slugifies to a stable placeholder key", () => {
    expect(toKey("Lunch Photo 🍱")).toBe("lunch_photo");
    expect(toKey("  Weight (kg)  ")).toBe("weight_kg");
    expect(toKey("mood")).toBe("mood");
    expect(toKey("__Trailing__")).toBe("trailing");
  });
});
