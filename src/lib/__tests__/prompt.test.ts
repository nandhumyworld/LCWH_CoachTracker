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
  derived: {
    lunch_photo: { calories: 650, items: ["rice", "dal"] },
  },
};

describe("fillPrompt", () => {
  it("substitutes scalar and profile placeholders", () => {
    const out = fillPrompt("Weigh {{q.weight}} vs {{profile.targetWeight}}", ctx);
    expect(out.text).toBe("Weigh 78 vs 70");
    expect(out.warnings).toEqual([]);
  });

  it("collects image placeholders as vision inputs with a labeled marker", () => {
    const out = fillPrompt("See {{q.lunch_photo}} today", ctx);
    expect(out.images).toEqual([{ questionKey: "lunch_photo", imageId: "img_1" }]);
    // The token becomes a label so multiple images stay distinguishable.
    expect(out.text).toBe("See [image: lunch_photo] today");
  });

  it("resolves derived (AI-extracted) fields via {{q.key.field}}", () => {
    const out = fillPrompt("Lunch was {{q.lunch_photo.calories}} kcal", ctx);
    expect(out.text).toBe("Lunch was 650 kcal");
    expect(out.warnings).toEqual([]);
  });

  it("renders array derived/answer values as a comma list", () => {
    expect(fillPrompt("Ate {{q.meals}}", ctx).text).toBe("Ate oats, salad");
    expect(fillPrompt("Items: {{q.lunch_photo.items}}", ctx).text).toBe("Items: rice, dal");
  });

  it("replaces unknown placeholders with empty string and warns", () => {
    const out = fillPrompt("Hi {{q.missing}} / {{profile.nope}} / {{q.lunch_photo.protein}}", ctx);
    expect(out.text).toBe("Hi  /  / ");
    expect(out.warnings).toContain("q.missing");
    expect(out.warnings).toContain("profile.nope");
    expect(out.warnings).toContain("q.lunch_photo.protein");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(fillPrompt("W {{ q.weight }}", ctx).text).toBe("W 78");
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
