import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { gateForStudentToday } from "@/lib/gate";
import { SignOutButton } from "@/components/SignOutButton";
import { GateGuard } from "./GateGuard";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("student");

  // Resolve today's gate so it can block the app. Only once intake is complete
  // (pre-intake the student is redirected to /student/intake anyway).
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, intakeAt: true },
  });
  const gate =
    student?.intakeAt != null
      ? await gateForStudentToday(student.id)
      : { message: null, acknowledged: false };
  // Shown on every login while a message is scheduled for today (CR-014); the
  // popup handles per-session dismissal client-side after acknowledgement.
  const showGate = gate.message != null;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <nav className="flex items-center gap-4">
            <Link href="/student" className="font-bold text-primary">
              LCWH
            </Link>
            <Link
              href="/student"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/student/today"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Today
            </Link>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-3xl p-4">{children}</div>
      {showGate && gate.message && (
        <GateGuard
          gateMessageId={gate.message.id}
          bodyText={gate.message.bodyText}
          ackButtonLabel={gate.message.ackButtonLabel}
          imageRefId={gate.message.imageRefId}
        />
      )}
    </div>
  );
}
