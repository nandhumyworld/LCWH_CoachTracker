import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { localDateFor } from "@/lib/day";
import { reportStatusLabel } from "@/lib/dashboard";
import { RetryButton } from "./RetryButton";

// Admin generation logs: every report with status, model, tokens, cost, and
// error, plus a retry button for failed ones (FR-29/30).
export default async function AdminLogsPage() {
  await requireRole("admin");

  const reports = await prisma.report.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      dailyEntry: {
        select: {
          localDate: true,
          student: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generation logs</h1>
        <p className="text-muted-foreground">
          Latest {reports.length} report{reports.length === 1 ? "" : "s"}.
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports generated yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Day</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Model</th>
                <th className="p-3 font-medium">Tokens</th>
                <th className="p-3 font-medium">Cost</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-3">{r.dailyEntry.student.user.name}</td>
                  <td className="p-3 whitespace-nowrap">
                    {localDateFor("UTC", r.dailyEntry.localDate)}
                  </td>
                  <td className="p-3">
                    <span className={r.status === "failed" ? "text-destructive" : ""}>
                      {reportStatusLabel(r.status)}
                    </span>
                    {r.status === "failed" && r.error && (
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{r.error}</p>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {r.modelId ?? "—"}
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {r.tokensIn != null || r.tokensOut != null
                      ? `${r.tokensIn ?? 0} / ${r.tokensOut ?? 0}`
                      : "—"}
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {r.costEstimate != null ? `$${r.costEstimate.toFixed(5)}` : "—"}
                  </td>
                  <td className="p-3">
                    {r.status === "failed" && <RetryButton reportId={r.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
