import { describe, it, expect } from "vitest";
import {
  buildMessages,
  parseCompletion,
  bufferToDataUrl,
} from "@/lib/openrouter";

describe("buildMessages", () => {
  it("wraps a text-only prompt as a single user text part", () => {
    const msgs = buildMessages("How did today go?", []);
    expect(msgs).toEqual([
      {
        role: "user",
        content: [{ type: "text", text: "How did today go?" }],
      },
    ]);
  });

  it("appends image_url parts for each vision input", () => {
    const msgs = buildMessages("Look:", [
      "data:image/png;base64,AAAA",
      "data:image/jpeg;base64,BBBB",
    ]);
    expect(msgs[0].content).toEqual([
      { type: "text", text: "Look:" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,BBBB" } },
    ]);
  });
});

describe("parseCompletion", () => {
  it("extracts text and usage from a chat completion response", () => {
    const out = parseCompletion({
      choices: [{ message: { content: "Great progress today!" } }],
      usage: { prompt_tokens: 120, completion_tokens: 45, cost: 0.00034 },
    });
    expect(out).toEqual({
      text: "Great progress today!",
      tokensIn: 120,
      tokensOut: 45,
      costEstimate: 0.00034,
    });
  });

  it("defaults missing usage fields to null", () => {
    const out = parseCompletion({
      choices: [{ message: { content: "ok" } }],
    });
    expect(out).toEqual({
      text: "ok",
      tokensIn: null,
      tokensOut: null,
      costEstimate: null,
    });
  });

  it("throws when the response has no message content", () => {
    expect(() => parseCompletion({ choices: [] })).toThrow();
  });
});

describe("bufferToDataUrl", () => {
  it("builds a base64 data URL with the given mime type", () => {
    const url = bufferToDataUrl(Buffer.from("hello"), "image/png");
    expect(url).toBe(`data:image/png;base64,${Buffer.from("hello").toString("base64")}`);
  });
});
