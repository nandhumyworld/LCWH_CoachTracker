import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock every IO dependency so generateReport can be unit-tested without a DB,
// storage backend, or network. report.ts imports neither @/auth nor next/*, so
// mocking these three modules keeps the test in pure node.
const findUnique = vi.fn();
const reportUpdate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    dailyEntry: { findUnique: (...a: unknown[]) => findUnique(...a) },
    report: { update: (...a: unknown[]) => reportUpdate(...a) },
  },
}));

const storageGet = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ get: (...a: unknown[]) => storageGet(...a) }),
}));

// report.ts resolves the fallback model via settings (SystemSetting → env);
// stub it so no DB/env is touched.
vi.mock("@/lib/settings", () => ({
  getDefaultModel: () => Promise.resolve("openai/gpt-4o-mini"),
}));

const callOpenRouter = vi.fn();
vi.mock("@/lib/openrouter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/openrouter")>(
    "@/lib/openrouter",
  );
  return { ...actual, callOpenRouter: (...a: unknown[]) => callOpenRouter(...a) };
});

import { generateReport } from "@/lib/report";

function entryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry_1",
    student: {
      heightCm: 170,
      currentWeightKg: 80,
      targetWeightKg: 70,
      profilePanel: { bmi: 27.7, bmr: 1600, weightToLoseKg: 10 },
      coach: {
        programSettings: {
          promptTemplate: {
            id: "tpl_1",
            body: "Weight {{q.weight}} vs {{profile.targetWeight}}. See {{q.lunch_photo}}",
            modelId: "anthropic/claude-3.5-sonnet",
          },
        },
      },
    },
    answers: [
      { question: { key: "weight", type: "number" }, value: 78, imageRefId: null, imageRef: null },
      {
        question: { key: "lunch_photo", type: "image" },
        value: null,
        imageRefId: "img_1",
        imageRef: {
          id: "img_1",
          storageKey: "students/s1/img_1.jpg",
          mimeType: "image/jpeg",
          deletedAt: null,
        },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateReport", () => {
  it("fills the prompt, sends images, and marks the report done", async () => {
    findUnique.mockResolvedValue(entryFixture());
    storageGet.mockResolvedValue({ body: Buffer.from("jpegbytes"), mimeType: "image/jpeg" });
    callOpenRouter.mockResolvedValue({
      text: "You are on track!",
      tokensIn: 100,
      tokensOut: 40,
      costEstimate: 0.0002,
    });

    await generateReport("entry_1");

    // The image byte was read from storage and passed as a data URL.
    expect(storageGet).toHaveBeenCalledWith("students/s1/img_1.jpg");
    const callArg = callOpenRouter.mock.calls[0][0];
    expect(callArg.modelId).toBe("anthropic/claude-3.5-sonnet");
    expect(callArg.prompt).toBe("Weight 78 vs 70. See ");
    expect(callArg.images).toHaveLength(1);
    expect(callArg.images[0]).toMatch(/^data:image\/jpeg;base64,/);

    // The report row was updated to done with body + usage + template id.
    expect(reportUpdate).toHaveBeenCalledTimes(1);
    const upd = reportUpdate.mock.calls[0][0];
    expect(upd.where).toEqual({ dailyEntryId: "entry_1" });
    expect(upd.data).toMatchObject({
      body: "You are on track!",
      modelId: "anthropic/claude-3.5-sonnet",
      promptTemplateId: "tpl_1",
      tokensIn: 100,
      tokensOut: 40,
      costEstimate: 0.0002,
      status: "done",
      error: null,
    });
  });

  it("marks the report failed and records the error when generation throws", async () => {
    findUnique.mockResolvedValue(entryFixture());
    storageGet.mockResolvedValue({ body: Buffer.from("x"), mimeType: "image/jpeg" });
    callOpenRouter.mockRejectedValue(new Error("OpenRouter request failed (429)"));

    await generateReport("entry_1");

    expect(reportUpdate).toHaveBeenCalledTimes(1);
    const upd = reportUpdate.mock.calls[0][0];
    expect(upd.where).toEqual({ dailyEntryId: "entry_1" });
    expect(upd.data.status).toBe("failed");
    expect(upd.data.error).toContain("OpenRouter request failed (429)");
  });

  it("falls back to the env default model when no template is configured", async () => {
    const entry = entryFixture();
    entry.student.coach.programSettings = null as never;
    findUnique.mockResolvedValue(entry);
    storageGet.mockResolvedValue({ body: Buffer.from("x"), mimeType: "image/jpeg" });
    callOpenRouter.mockResolvedValue({ text: "ok", tokensIn: null, tokensOut: null, costEstimate: null });

    await generateReport("entry_1");

    const callArg = callOpenRouter.mock.calls[0][0];
    // OPENROUTER_DEFAULT_MODEL default from env schema.
    expect(callArg.modelId).toBe("openai/gpt-4o-mini");
    const upd = reportUpdate.mock.calls[0][0];
    expect(upd.data.promptTemplateId).toBeNull();
    expect(upd.data.status).toBe("done");
  });

  it("skips a deleted image instead of sending stale bytes", async () => {
    const entry = entryFixture();
    // Mark the referenced image as retention-deleted.
    (entry.answers[1].imageRef as { deletedAt: Date | null }).deletedAt = new Date();
    findUnique.mockResolvedValue(entry);
    callOpenRouter.mockResolvedValue({ text: "ok", tokensIn: null, tokensOut: null, costEstimate: null });

    await generateReport("entry_1");

    expect(storageGet).not.toHaveBeenCalled();
    expect(callOpenRouter.mock.calls[0][0].images).toEqual([]);
  });
});
