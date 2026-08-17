// Report generation. Phase 6 implements the OpenRouter call, prompt filling,
// and token/cost recording. For now this is a no-op stub: the Report row stays
// `pending` after submit/auto-submit until Phase 6 lands, at which point this
// function fills it in.
export async function generateReport(_dailyEntryId: string): Promise<void> {
  // TODO(phase-6): load answers+profile+images, fill prompt, call OpenRouter,
  // store body + model + tokens + cost, set status done/failed.
}
