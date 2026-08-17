import { requireRole } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/SignOutButton";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("student");
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <span className="font-bold text-primary">LCWH</span>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-3xl p-4">{children}</div>
    </div>
  );
}
