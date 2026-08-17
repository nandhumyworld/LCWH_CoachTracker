import { requireRole } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/SignOutButton";

// Placeholder admin home — replaced by prompt editor / settings / logs later.
export default async function AdminHome() {
  const user = await requireRole("admin");
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <SignOutButton />
      </div>
      <p className="text-muted-foreground">
        Signed in as {user.name} ({user.email}). Prompt editor, model settings,
        and generation logs arrive in later phases.
      </p>
    </main>
  );
}
