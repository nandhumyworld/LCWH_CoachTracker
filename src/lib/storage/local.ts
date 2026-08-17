import { promises as fs } from "fs";
import path from "path";
import type { PutInput, StorageService } from "./types";

// Local-disk backend. Bytes live under STORAGE_LOCAL_DIR, which is a mounted
// Docker volume in both local dev and production (Coolify persistent storage).
export class LocalDiskStorage implements StorageService {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    // Prevent path traversal out of baseDir.
    const full = path.resolve(this.baseDir, key);
    const root = path.resolve(this.baseDir);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  async put({ key, body }: PutInput): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async get(key: string): Promise<{ body: Buffer; mimeType: string } | null> {
    try {
      const full = this.resolve(key);
      const body = await fs.readFile(full);
      // MIME type is authoritative in the DB (StoredImage.mimeType); callers
      // pass it through. Return a generic default here.
      return { body, mimeType: "application/octet-stream" };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return; // idempotent
      throw err;
    }
  }
}
