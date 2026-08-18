import { requireRole } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/SignOutButton";

// Placeholder coach home — replaced by the dashboard in Phase 8.
export default async function CoachHome() {
  const user = await requireRole("coach");
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Coach</h1>
        <SignOutButton />
      </div>
      <p className="text-muted-foreground">
        Signed in as {user.name} ({user.email}). Program builder, students, and
        dashboard arrive in later phases.
      </p>
    </main>
  );
}
