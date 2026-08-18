import { describe, it, expect } from "vitest";
import { fillPrompt } from "@/lib/prompt";

const ctx = {
  profile: { targetWeight: 70, bmi: 27.7 },
  answers: {
    weight: 78,
    mood: 4,
    lunch_photo: { imageId: "img_1" },
    meals: ["oats", "salad"],
  },
};

describe("fillPrompt", () => {
  it("substitutes scalar and profile placeholders", () => {
    const out = fillPrompt("Weigh {{q.weight}} vs {{profile.targetWeight}}", ctx);
    expect(out.text).toBe("Weigh 78 vs 70");
    expect(out.warnings).toEqual([]);
  });

  it("collects image placeholders as vision inputs and strips the token", () => {
    const out = fillPrompt("See {{q.lunch_photo}} today", ctx);
    expect(out.images).toEqual([{ questionKey: "lunch_photo", imageId: "img_1" }]);
    // The image token is removed from the text (no literal placeholder left).
    expect(out.text).not.toContain("{{q.lunch_photo}}");
    expect(out.text).toBe("See  today");
  });

  it("renders array (checkbox) answers as a comma-joined list", () => {
    const out = fillPrompt("Ate {{q.meals}}", ctx);
    expect(out.text).toBe("Ate oats, salad");
  });

  it("replaces unknown placeholders with empty string and warns", () => {
    const out = fillPrompt("Hi {{q.missing}} / {{profile.nope}}", ctx);
    expect(out.text).toBe("Hi  / ");
    expect(out.warnings).toContain("q.missing");
    expect(out.warnings).toContain("profile.nope");
  });

  it("tolerates whitespace inside the braces", () => {
    const out = fillPrompt("W {{ q.weight }}", ctx);
    expect(out.text).toBe("W 78");
  });

  it("does not duplicate a repeated image placeholder in vision inputs", () => {
    const out = fillPrompt("{{q.lunch_photo}} and again {{q.lunch_photo}}", ctx);
    expect(out.images).toEqual([{ questionKey: "lunch_photo", imageId: "img_1" }]);
  });

  it("leaves non-placeholder text untouched", () => {
    const out = fillPrompt("No tokens here.", ctx);
    expect(out.text).toBe("No tokens here.");
    expect(out.images).toEqual([]);
    expect(out.warnings).toEqual([]);
  });
});
