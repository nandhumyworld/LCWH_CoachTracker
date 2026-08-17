import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("s3cret!");
    expect(h).not.toBe("s3cret!");
    expect(await verifyPassword("s3cret!", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});
