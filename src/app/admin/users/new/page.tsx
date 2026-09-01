import { requireRole } from "@/lib/auth-guards";
import { CreateUserForm } from "./CreateUserForm";

export default async function NewUserPage() {
  await requireRole("admin");
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Create user</h1>
      <CreateUserForm />
    </main>
  );
}
