import { headers } from "next/headers";

// Builds an absolute URL from the incoming request origin (falls back to
// AUTH_URL) so links work in dev and prod without hardcoding.
export async function originUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = host ? `${proto}://${host}` : (process.env.AUTH_URL ?? "");
  return `${base}${path}`;
}
