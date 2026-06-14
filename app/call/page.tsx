// Live Grok Voice call page — speak to the Fairy agent in real time.
// Reachable at /call. Uses the browser mic + xAI Grok Voice realtime WebSocket
// (ephemeral token from /api/voice/route). No telephony.
import { GrokVoiceCall } from "@/components/fairy/GrokVoiceCall";

export const metadata = {
  title: "Fairy — Live Grok Voice call",
};

export default function CallPage() {
  return <GrokVoiceCall />;
}
