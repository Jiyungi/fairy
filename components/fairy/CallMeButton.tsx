"use client";

// ===========================================================================
// CallMeButton (components/fairy/CallMeButton.tsx)
//
// One tap places a REAL phone call to the demo number (AGENTPHONE_TO_NUMBER) via
// AgentPhone in webhook mode — Grok is the conversational brain. Used to show
// the agentic loop live: press it, the phone rings, you talk to Grok.
// ===========================================================================

import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";

type Status = "idle" | "calling" | "placed" | "error";

export function CallMeButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function placeCall() {
    setStatus("calling");
    setMessage("");
    try {
      const res = await fetch("/api/agentphone/call", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error ?? "Couldn't place the call.");
        return;
      }
      setStatus("placed");
      setMessage(data.message ?? "Calling now — pick up your phone.");
    } catch {
      setStatus("error");
      setMessage("Network error placing the call.");
    }
  }

  const busy = status === "calling";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Hear Fairy work</p>
          <p className="text-xs text-muted-foreground">
            Fairy calls your phone and Grok handles the conversation live.
          </p>
        </div>
        <button
          type="button"
          onClick={placeCall}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Phone className="h-4 w-4" aria-hidden />
          )}
          {busy ? "Calling…" : "Call me now"}
        </button>
      </div>
      {message ? (
        <p
          className={`mt-3 text-xs ${
            status === "error" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
