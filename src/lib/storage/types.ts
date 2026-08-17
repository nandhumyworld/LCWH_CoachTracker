// StorageService abstraction (spec §5, NFR-2).
// The app only ever talks to this interface. Swapping the local-disk backend
// for MinIO/S3 later requires a new implementation, no application changes.

export interface PutInput {
  /** Opaque storage key, e.g. "students/<id>/2026-08-17/<uuid>.jpg". */
  key: string;
  body: Buffer;
  mimeType: string;
}

export interface StorageService {
  /** Persist bytes under `key`. */
  put(input: PutInput): Promise<void>;
  /** Read bytes back for app-authenticated serving (NFR-4). */
  get(key: string): Promise<{ body: Buffer; mimeType: string } | null>;
  /** Delete bytes (retention cleanup, NFR-3). Idempotent. */
  delete(key: string): Promise<void>;
}
