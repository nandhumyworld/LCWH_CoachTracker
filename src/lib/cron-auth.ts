import { env } from "@/lib/env";

// Guards /api/cron/* routes. n8n (or any scheduler) must send:
//   Authorization: Bearer <CRON_SECRET>
// Returns true when the request is authorized.
export function isAuthorizedCron(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  // Constant-time-ish compare: lengths must match and every char must match.
  if (header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
