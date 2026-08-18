import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

// Admin overview: quick links + a failed-report count so problems are visible.
export default async function AdminHome() {
  const user = await requireRole("admin");
  const [failed, students] = await Promise.all([
    prisma.report.count({ where: { status: "failed" } }),
    prisma.student.count(),
  ]);

  const cards = [
    { href: "/admin/prompt", title: "Report prompt", desc: "Edit the AI prompt + model." },
    { href: "/admin/settings", title: "Settings", desc: "Photo retention + default model." },
    {
      href: "/admin/logs",
      title: "Generation logs",
      desc: failed > 0 ? `${failed} failed — needs retry` : "All reports healthy.",
    },
  ];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted-foreground">
          Signed in as {user.name} · {students} student{students === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border p-4 hover:bg-muted/50"
          >
            <p className="font-medium">{c.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
