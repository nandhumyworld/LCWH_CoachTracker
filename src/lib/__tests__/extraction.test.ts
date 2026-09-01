import { describe, it, expect } from "vitest";
import { parseJsonObject, distributeDerived, isNoMeal, NO_MEAL } from "@/lib/extraction-util";

describe("isNoMeal", () => {
  it("is a no-meal when there's neither a photo nor a note", () => {
    expect(isNoMeal({ hasImage: false, note: "" })).toBe(true);
    expect(isNoMeal({ hasImage: false, note: "   " })).toBe(true);
  });

  it("is analyzable when a photo is present", () => {
    expect(isNoMeal({ hasImage: true, note: "" })).toBe(false);
  });

  it("is analyzable when a note is present (photo optional)", () => {
    expect(isNoMeal({ hasImage: false, note: "two rotis and dal" })).toBe(false);
    expect(isNoMeal({ hasImage: true, note: "rice" })).toBe(false);
  });

  it("exposes the derived marker used for a skipped meal", () => {
    expect(NO_MEAL).toMatchObject({ skipped: true, calories: 0 });
  });
});

describe("parseJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(parseJsonObject('{"calories":650,"items":["rice"]}')).toEqual({
      calories: 650,
      items: ["rice"],
    });
  });

  it("parses JSON inside a ```json fence", () => {
    const text = "Here you go:\n```json\n{ \"calories\": 500 }\n```\nHope that helps.";
    expect(parseJsonObject(text)).toEqual({ calories: 500 });
  });

  it("parses JSON embedded in prose (first { to last })", () => {
    const text = 'The result is {"lunch_photo": {"calories": 700}} based on the photo.';
    expect(parseJsonObject(text)).toEqual({ lunch_photo: { calories: 700 } });
  });

  it("returns null when there is no JSON object", () => {
    expect(parseJsonObject("no json here")).toBeNull();
    expect(parseJsonObject("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseJsonObject("{ calories: }")).toBeNull();
  });
});

describe("distributeDerived", () => {
  const answersByKey = {
    lunch_photo: "ans_1",
    dinner_photo: "ans_2",
  };

  it("maps per-key extracted objects to their answer ids", () => {
    const parsed = {
      lunch_photo: { calories: 650, items: ["rice"] },
      dinner_photo: { calories: 800 },
    };
    expect(distributeDerived(parsed, answersByKey)).toEqual([
      { answerId: "ans_1", derived: { calories: 650, items: ["rice"] } },
      { answerId: "ans_2", derived: { calories: 800 } },
    ]);
  });

  it("wraps a flat single-image result under the only analyzed key", () => {
    // Model returned { calories, items } directly (one image) instead of keying it.
    const parsed = { calories: 650, items: ["rice"] };
    expect(distributeDerived(parsed, { lunch_photo: "ans_1" })).toEqual([
      { answerId: "ans_1", derived: { calories: 650, items: ["rice"] } },
    ]);
  });

  it("ignores keys that aren't analyzed answers", () => {
    const parsed = { unknown_key: { calories: 1 } };
    expect(distributeDerived(parsed, answersByKey)).toEqual([]);
  });
});
