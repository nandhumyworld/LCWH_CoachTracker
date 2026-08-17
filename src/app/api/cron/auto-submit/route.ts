import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

// Called by n8n on a schedule (e.g. every 15 min).
// Finds students whose local time has passed 23:59 with an `open` DailyEntry,
// auto-submits them, and enqueues report generation (spec §7).
//
// BOILERPLATE STUB: wired and secured, but the sweep logic lands in the
// "Daily lock / auto-submit engine" task of the plan.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // TODO(plan: auto-submit-engine): implement the per-timezone sweep.
  return NextResponse.json({ ok: true, processed: 0, stub: true });
}
