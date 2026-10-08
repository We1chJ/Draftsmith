import { route } from "@/lib/api";
import { refreshVoiceSummary } from "@/lib/voice-summary";

// Rewrites the voice summary from all published posts. One model call.
export const POST = route(async (_req, userId) => {
  const voice = await refreshVoiceSummary(userId);
  return { ...voice, summary_stale: false };
});
