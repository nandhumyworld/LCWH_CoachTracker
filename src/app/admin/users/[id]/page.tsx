import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { UserEditor, type EditorData } from "./UserEditor";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      student: {
        select: {
          timezone: true,
          status: true,
          coachId: true,
          heightCm: true,
          currentWeightKg: true,
          targetWeightKg: true,
        },
      },
    },
  });
  if (!user) notFound();

  const [coaches, audit] = await Promise.all([
    prisma.coach.findMany({ select: { id: true, user: { select: { name: true } } } }),
    prisma.adminAuditLog.findMany({
      where: { targetUserId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const data: EditorData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    student: user.student
      ? {
          timezone: user.student.timezone,
          status: user.student.status,
          coachId: user.student.coachId,
          heightCm: user.student.heightCm,
          currentWeightKg: user.student.currentWeightKg,
          targetWeightKg: user.student.targetWeightKg,
        }
      : null,
    coaches: coaches.map((c) => ({ id: c.id, name: c.user.name })),
    audit: audit.map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details as Record<string, { from: unknown; to: unknown }> | null,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  return <UserEditor data={data} />;
}
