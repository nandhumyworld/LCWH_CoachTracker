import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Liveness + DB readiness probe. Coolify health check can hit this.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down" },
      { status: 503 },
    );
  }
}
