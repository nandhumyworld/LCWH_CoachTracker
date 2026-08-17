import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

// Called by n8n on a schedule (e.g. daily).
// Deletes stored image files older than PHOTO_RETENTION_DAYS and nulls their
// DB pointers to reclaim space (spec §5, NFR-3).
//
// BOILERPLATE STUB: wired and secured, but the deletion logic lands in the
// "Photo retention cleanup" task of the plan.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // TODO(plan: photo-retention): find expired StoredImage rows, storage.delete
  // each key, set deletedAt, keep metadata row.
  return NextResponse.json({ ok: true, deleted: 0, stub: true });
}
