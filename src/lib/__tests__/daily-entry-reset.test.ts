import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB and storage so resetDailyEntry can be unit-tested in pure node.
const findUnique = vi.fn();
const $transaction = vi.fn();
const reportDeleteMany = vi.fn();
const answerDeleteMany = vi.fn();
const imageDeleteMany = vi.fn();
const entryUpdate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    dailyEntry: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => entryUpdate(...a),
    },
    report: { deleteMany: (...a: unknown[]) => reportDeleteMany(...a) },
    answer: { deleteMany: (...a: unknown[]) => answerDeleteMany(...a) },
    storedImage: { deleteMany: (...a: unknown[]) => imageDeleteMany(...a) },
    // Our reset passes an array of query builders; return their resolved values.
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

const storageDelete = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ delete: (...a: unknown[]) => storageDelete(...a) }),
}));

import { resetDailyEntry } from "@/lib/daily-entry-reset";

beforeEach(() => {
  vi.clearAllMocks();
  // The builders are lazy in real Prisma; here we just resolve the counts the
  // action reads back, in call order: report, answer, image, entryUpdate.
  $transaction.mockResolvedValue([
    { count: 1 },
    { count: 3 },
    { count: 2 },
    { id: "entry_1", status: "open" },
  ]);
  storageDelete.mockResolvedValue(undefined);
});

describe("resetDailyEntry", () => {
  it("deletes the day's data, its image bytes, and reopens the entry", async () => {
    findUnique.mockResolvedValue({
      id: "entry_1",
      images: [
        { id: "img_1", storageKey: "students/s1/a.jpg" },
        { id: "img_2", storageKey: "students/s1/b.jpg" },
      ],
    });

    const result = await resetDailyEntry("entry_1");

    // Byte deletion happened for every stored image (idempotent, best-effort).
    expect(storageDelete).toHaveBeenCalledTimes(2);
    expect(storageDelete).toHaveBeenCalledWith("students/s1/a.jpg");
    expect(storageDelete).toHaveBeenCalledWith("students/s1/b.jpg");

    expect(result).toEqual({
      answersDeleted: 3,
      imagesDeleted: 2,
      reportDeleted: true,
    });
  });

  it("still resets a day that has no images", async () => {
    findUnique.mockResolvedValue({ id: "entry_1", images: [] });
    $transaction.mockResolvedValue([
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { id: "entry_1", status: "open" },
    ]);

    const result = await resetDailyEntry("entry_1");

    expect(storageDelete).not.toHaveBeenCalled();
    expect(result.reportDeleted).toBe(false);
    expect(result.imagesDeleted).toBe(0);
  });

  it("throws when the entry does not exist", async () => {
    findUnique.mockResolvedValue(null);
    await expect(resetDailyEntry("missing")).rejects.toThrow("not found");
  });
});
