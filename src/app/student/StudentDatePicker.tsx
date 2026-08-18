"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Jump to any past day's report/answers (CR-003). `max` = today (student tz).
export function StudentDatePicker({ max }: { max: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="day-date" className="text-sm">
        View a day
      </Label>
      <Input
        id="day-date"
        type="date"
        max={max}
        className="w-auto"
        onChange={(e) => {
          if (e.target.value) router.push(`/student/day/${e.target.value}`);
        }}
      />
    </div>
  );
}
