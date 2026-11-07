"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { extractMoodleToken } from "@/lib/lms/ssoToken";

const PENDING_KEY = "faida_lms_sso";
const PENDING_MAX_AGE_MS = 15 * 60 * 1000;

type View = { state: "working"; text: string } | { state: "done"; text: string } | { state: "error"; text: string };

/**
 * Where the LMS sends you back after "Sign in with my university account". The LMS hands over the
 * access key in the address after the # (which is never sent to the server); it is read here, removed
 * from the address bar at once, and saved encrypted through the normal connect route.
 */
export default function LmsSsoReturnPage() {
  const router = useRouter();
  const ran = useRef(false);
  const [view, setView] = useState<View>({ state: "working", text: "Finishing your LMS connection…" });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = window.location.hash.replace(/^#/, "");
    const raw = new URLSearchParams(hash).get("uri") || "";
    // Remove the key from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);

    const fail = (text: string) => setView({ state: "error", text });

    (async () => {
      let pending: { base?: string; ts?: number } | null = null;
      try {
        pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
      } catch {}

      // Only accept a sign-in this browser started a moment ago, so a link someone else sends cannot connect an account.
      if (!pending?.base || !pending.ts || Date.now() - pending.ts > PENDING_MAX_AGE_MS) {
        return fail("This sign-in was not started from this browser, or it took too long. Start again from University → Connect LMS.");
      }
      const token = extractMoodleToken(raw);
      if (!token) return fail("The LMS did not hand back a usable key. Start again from University → Connect LMS.");

      try {
        const res = await fetch("/api/lms/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl: pending.base, token }),
        });
        const json = await res.json();
        localStorage.removeItem(PENDING_KEY);
        if (!json.success) return fail(json.error || "The connection could not be completed.");
        const s = json.summary;
        setView({
          state: "done",
          text: `Connected${json.studentName ? ` as ${json.studentName}` : ""}. ${s && !s.skipped ? `Read ${s.courses ?? 0} units and ${s.items ?? 0} items.` : json.message || ""}`.trim(),
        });
        setTimeout(() => router.replace("/university"), 1800);
      } catch {
        fail("Could not reach Faida OS. Check your connection and start again.");
      }
    })();
  }, [router]);

  const tone =
    view.state === "done"
      ? "border-emerald-500/30 text-emerald-200"
      : view.state === "error"
      ? "border-rose-500/30 text-rose-200"
      : "border-blue-500/30 text-blue-100";

  return (
    <div className="max-w-md mx-auto pt-16">
      <div className={`rounded-2xl bg-slate-900/60 border p-6 space-y-3 text-center ${tone}`}>
        <div className="flex justify-center">
          {view.state === "working" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : view.state === "done" ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <AlertTriangle className="h-6 w-6" />
          )}
        </div>
        <h1 className="text-sm font-bold text-white">University sign-in</h1>
        <p className="text-xs leading-relaxed break-words">{view.text}</p>
        {view.state !== "working" && (
          <Link href="/university" className="inline-block text-xs font-semibold text-blue-300 hover:underline">
            Back to University
          </Link>
        )}
      </div>
    </div>
  );
}
