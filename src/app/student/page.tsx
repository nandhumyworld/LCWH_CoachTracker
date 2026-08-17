import { requireRole } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/SignOutButton";

// Placeholder student home — replaced by intake/daily check-in in later phases.
export default async function StudentHome() {
  const user = await requireRole("student");
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Student</h1>
        <SignOutButton />
      </div>
      <p className="text-muted-foreground">
        Signed in as {user.name} ({user.email}). Intake, daily check-in, and
        reports arrive in later phases.
      </p>
    </main>
  );
}
