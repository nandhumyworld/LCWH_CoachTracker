import { env } from "@/lib/env";
import { LocalDiskStorage } from "./local";
import type { StorageService } from "./types";

export type { StorageService, PutInput } from "./types";

// Single place that picks the backend from config. Add MinIO/S3 here later.
// Lazy so env is not parsed at import time (which would run during build).
let instance: StorageService | null = null;

export function getStorage(): StorageService {
  if (instance) return instance;
  switch (env.STORAGE_DRIVER) {
    case "local":
      instance = new LocalDiskStorage(env.STORAGE_LOCAL_DIR);
      break;
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${env.STORAGE_DRIVER}`);
  }
  return instance;
}
