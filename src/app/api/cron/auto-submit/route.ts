import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAutoSubmit } from "@/lib/auto-submit";

// Called by n8n on a schedule (e.g. every 15 min).
// Finds students whose local time has passed 23:59 with an `open` DailyEntry,
// auto-submits them, and enqueues report generation (spec §7).
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runAutoSubmit();
  return NextResponse.json({ ok: true, ...summary });
}
