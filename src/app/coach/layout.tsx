import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/SignOutButton";

const NAV = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/questions", label: "Questions" },
  { href: "/coach/students", label: "Students" },
  { href: "/coach/settings", label: "Form settings" },
];

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("coach");
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <nav className="flex items-center gap-4">
            <span className="font-bold text-primary">LCWH</span>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl p-4">{children}</div>
    </div>
  );
}
