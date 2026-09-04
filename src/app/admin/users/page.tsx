import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { UsersList, type UserRow } from "./UsersList";

export default async function AdminUsersPage() {
  await requireRole("admin");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      student: { select: { status: true } },
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.student?.status ?? null,
  }));

  return <UsersList initial={rows} />;
}
