"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Navigates to /coach/attendance?date=... when the coach picks a date.
export function AttendanceDatePicker({ date }: { date: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="att-date">Date</Label>
      <Input
        id="att-date"
        type="date"
        value={date}
        className="w-auto"
        onChange={(e) => router.push(`/coach/attendance?date=${e.target.value}`)}
      />
    </div>
  );
}
