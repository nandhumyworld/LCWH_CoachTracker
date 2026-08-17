import { z } from "zod";

// Validate environment lazily on first access. Parsing at import time would
// run during `next build` page-data collection (when runtime secrets are not
// present) and fail the build. A lazy proxy defers validation to request time
// while still failing fast with a clear message if something is missing.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),

  OPENROUTER_API_KEY: z.string().optional().default(""),
  OPENROUTER_DEFAULT_MODEL: z.string().default("openai/gpt-4o-mini"),

  CRON_SECRET: z.string().min(1),

  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("/data/uploads"),
  PHOTO_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  NEXT_PUBLIC_APP_NAME: z.string().default("LifeChanging Wellness Hub"),
  NEXT_PUBLIC_APP_SHORT_NAME: z.string().default("LCWH"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
function load(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return load()[prop as keyof Env];
  },
});
