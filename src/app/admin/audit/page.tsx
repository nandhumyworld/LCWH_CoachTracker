import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminAuditPage() {
  await requireRole("admin");

  const entries = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Resolve actor/target names in one round-trip.
  const ids = Array.from(
    new Set(entries.flatMap((e) => [e.actorUserId, e.targetUserId])),
  );
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        )}
        {entries.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{e.action}</p>
                <p className="truncate text-muted-foreground">
                  by {nameOf.get(e.actorUserId) ?? e.actorUserId} on{" "}
                  <Link className="underline" href={`/admin/users/${e.targetUserId}`}>
                    {nameOf.get(e.targetUserId) ?? e.targetUserId}
                  </Link>
                </p>
              </div>
              <span className="shrink-0 text-muted-foreground">
                {e.createdAt.toLocaleString()}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
