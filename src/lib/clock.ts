import { getSetting, setSetting } from "@/lib/settings";
import {
  SETTING_KEYS,
  parseClockOffsetMs,
  computeClockOffsetMs,
} from "@/lib/settings-util";

// Admin testing clock (CR-017). The app's notion of "now" everywhere flows
// through getNow() so an admin can move the whole system to a simulated date to
// test schedule-driven behaviour (auto-submit cutoff, daily gate messages, the
// day rollover) without waiting for real calendar days. The override is a signed
// millisecond offset stored in SystemSetting, so time still advances naturally
// from the simulated instant; clearing it returns to real time immediately.

// Effective offset applied to real time (ms). 0 = real time.
export async function getClockOffsetMs(): Promise<number> {
  return parseClockOffsetMs(await getSetting(SETTING_KEYS.clockOffsetMs));
}

// The current effective instant: real time shifted by the admin offset.
export async function getNow(): Promise<Date> {
  return new Date(Date.now() + (await getClockOffsetMs()));
}

// Whether a simulated clock is currently active.
export async function isClockSimulated(): Promise<boolean> {
  return (await getClockOffsetMs()) !== 0;
}

// Move the system clock so that "now" reads as `target`. Passing an invalid
// date clears the override (returns to real time).
export async function setSimulatedNow(target: Date): Promise<void> {
  const offset = computeClockOffsetMs(target.getTime(), Date.now());
  await setSetting(SETTING_KEYS.clockOffsetMs, String(offset));
}

// Return to real time.
export async function clearSimulatedClock(): Promise<void> {
  await setSetting(SETTING_KEYS.clockOffsetMs, "0");
}
