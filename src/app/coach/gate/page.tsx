import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { localDateFor } from "@/lib/day";
import { getNow } from "@/lib/clock";
import { localDateToUtc } from "@/lib/daily-entry-util";
import { GateComposer } from "./GateComposer";

// Coach composes/pre-schedules the daily login-gate message (one per date, up
// to a week ahead) and sees what is already scheduled from today onward.
export default async function CoachGatePage() {
  const { coachId } = await requireCoach();
  const today = localDateFor("UTC", await getNow());

  const upcoming = await prisma.dailyGateMessage.findMany({
    where: { coachId, scheduledDate: { gte: localDateToUtc(today) } },
    orderBy: { scheduledDate: "asc" },
    include: { _count: { select: { acknowledgements: true } } },
  });

  const scheduled = upcoming.map((m) => ({
    id: m.id,
    date: localDateFor("UTC", m.scheduledDate),
    bodyText: m.bodyText,
    ackButtonLabel: m.ackButtonLabel,
    imageRefId: m.imageRefId,
    acks: m._count.acknowledgements,
  }));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Daily message</h1>
        <p className="text-muted-foreground">
          A full-screen message students must acknowledge before using the app.
          One per day, schedulable up to a week ahead.
        </p>
      </div>

      <GateComposer today={today} scheduled={scheduled} />
    </main>
  );
}
