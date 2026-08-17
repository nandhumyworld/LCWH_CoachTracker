import { Card, CardContent } from "@/components/ui/card";

export interface ProfilePanelData {
  bmi: number | null;
  bmr: number | null;
  weightToLoseKg: number | null;
  bmiCategory?: string;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// Read-only profile panel shown atop the student dashboard and on the coach's
// per-student view.
export function ProfilePanelCard({ data }: { data: ProfilePanelData }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="BMI"
            value={
              data.bmi != null
                ? `${data.bmi}${data.bmiCategory ? ` · ${data.bmiCategory}` : ""}`
                : "—"
            }
          />
          <Stat label="BMR (kcal/day)" value={data.bmr != null ? String(data.bmr) : "—"} />
          <Stat
            label="Current weight"
            value={data.currentWeightKg != null ? `${data.currentWeightKg} kg` : "—"}
          />
          <Stat
            label="To lose"
            value={data.weightToLoseKg != null ? `${data.weightToLoseKg} kg` : "—"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
