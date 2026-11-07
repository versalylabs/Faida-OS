"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send, Smartphone } from "lucide-react";

interface Prefs {
  enabled: boolean;
  nightBefore: boolean;
  nightHour: number;
  hourBefore: boolean;
  leadMinutes: number;
  morningHour: number;
  quietStart: number;
  quietEnd: number;
  events: boolean;
  academic: boolean;
  business: boolean;
  reminders: boolean;
  tasks: boolean;
  maintenance: boolean;
  classes: boolean;
}

interface Status {
  configured: boolean;
  publicKey: string | null;
  devices: number;
  prefs: Prefs;
}

const CATEGORIES: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "academic", label: "CATs & assignments", hint: "From your LMS and university page" },
  { key: "events", label: "Meetings & events", hint: "Client meetings and anything on your calendar" },
  { key: "reminders", label: "Your reminders", hint: "Sent at the time you set" },
  { key: "business", label: "Business deliverables", hint: "Due dates in the Business Hub" },
  { key: "tasks", label: "Task deadlines", hint: "Tasks with a due date" },
  { key: "classes", label: "Classes", hint: "15 minutes before a class or live session" },
  { key: "maintenance", label: "Maintenance", hint: "On the morning it is due" },
];

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;

function keyToBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Turn reminders on for this device and choose what to be told about, and when. */
export function NotificationSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [thisDevice, setThisDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);

  const refreshDevice = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setThisDevice(Boolean(sub));
    } catch {
      setThisDevice(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/push", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setStatus(json);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    refreshDevice();
  }, [load, refreshDevice]);

  const say = (text: string, tone: "ok" | "bad" = "ok") => setMessage({ text, tone });

  const turnOn = async () => {
    if (!status?.publicKey) return say("Notifications are not set up on the server yet.", "bad");
    setBusy(true);
    setMessage(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        say("Notifications are blocked. Allow them for this site in your browser settings, then try again.", "bad");
        return;
      }
      // The service worker is only active in the installed/production app; do not wait forever without it.
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no service worker")), 8000)),
      ]);
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(status.publicKey) as BufferSource }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const json = await res.json();
      if (!json.success) {
        say(json.error || "Could not register this device.", "bad");
        return;
      }
      setThisDevice(true);
      say("Notifications are on for this device. Press “Send a test” to check.");
      await load();
    } catch {
      say("Could not turn notifications on here. Install Faida OS to your home screen or use Chrome, then try again.", "bad");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setThisDevice(false);
      say("Notifications are off for this device.");
      await load();
    } catch {
      say("Could not turn notifications off. Try again.", "bad");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const json = await res.json();
      say(json.success ? `Sent to ${json.sent} device${json.sent === 1 ? "" : "s"}. It should arrive in a few seconds.` : json.error || "The test did not send.", json.success ? "ok" : "bad");
    } catch {
      say("Could not reach the server.", "bad");
    } finally {
      setBusy(false);
    }
  };

  const update = async (patch: Partial<Prefs>) => {
    if (!status) return;
    setStatus({ ...status, prefs: { ...status.prefs, ...patch } });
    try {
      const res = await fetch("/api/push", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const json = await res.json();
      if (json.success) setStatus((s) => (s ? { ...s, prefs: json.prefs } : s));
      else {
        say(json.error || "Could not save that.", "bad");
        load();
      }
    } catch {
      say("Could not save that. Check your connection.", "bad");
      load();
    }
  };

  const p = status?.prefs;
  const select = "bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500";
  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4" aria-labelledby="notif-heading">
      <div className="flex items-start gap-2.5">
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 id="notif-heading" className="text-sm font-semibold text-slate-100">
            Notifications
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">Get reminders on this phone or laptop for CATs, assignments, meetings and your own reminders, even when Faida OS is closed.</p>
        </div>
      </div>

      {!supported ? (
        <p className="text-xs text-amber-200 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
          This browser cannot receive notifications. On Android use Chrome and install Faida OS to the home screen; on iPhone, install it to the home screen first (iOS 16.4 or newer).
        </p>
      ) : !status ? (
        <p className="text-xs text-slate-300 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : !status.configured ? (
        <p className="text-xs text-amber-200 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">Notifications are not set up on the server yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {thisDevice ? (
              <button onClick={turnOff} disabled={busy} className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold disabled:opacity-60 whitespace-nowrap">
                <BellOff className="h-3.5 w-3.5" /> Turn off on this device
              </button>
            ) : (
              <button onClick={turnOn} disabled={busy} className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60 whitespace-nowrap">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />} Turn on for this device
              </button>
            )}
            <button onClick={sendTest} disabled={busy || status.devices === 0} className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold disabled:opacity-50 whitespace-nowrap">
              <Send className="h-3.5 w-3.5" /> Send a test
            </button>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Smartphone className="h-3.5 w-3.5" /> {status.devices} device{status.devices === 1 ? "" : "s"} registered
              {permission === "denied" ? " · blocked in browser settings" : ""}
            </span>
          </div>

          {message && (
            <p className={`text-xs p-2.5 rounded-lg border ${message.tone === "ok" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200" : "bg-rose-500/10 border-rose-500/25 text-rose-200"}`}>{message.text}</p>
          )}

          {p && (
            <div className="space-y-4 pt-1">
              <label className="flex items-center justify-between gap-3 text-xs text-slate-100 font-medium">
                <span>Reminders enabled</span>
                <input type="checkbox" checked={p.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="h-4 w-4 accent-blue-500" />
              </label>

              <div className={`space-y-3 ${p.enabled ? "" : "opacity-50 pointer-events-none"}`}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2">
                    <label className="flex items-center justify-between gap-3 text-xs text-slate-100 font-medium">
                      <span>The evening before</span>
                      <input type="checkbox" checked={p.nightBefore} onChange={(e) => update({ nightBefore: e.target.checked })} className="h-4 w-4 accent-blue-500" />
                    </label>
                    <div className="flex items-center gap-2 text-[11px] text-slate-300">
                      at
                      <select value={p.nightHour} onChange={(e) => update({ nightHour: Number(e.target.value) })} className={select} aria-label="Evening reminder time">
                        {hours.filter((h) => h >= 15).map((h) => (
                          <option key={h} value={h}>
                            {hourLabel(h)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2">
                    <label className="flex items-center justify-between gap-3 text-xs text-slate-100 font-medium">
                      <span>Shortly before it starts</span>
                      <input type="checkbox" checked={p.hourBefore} onChange={(e) => update({ hourBefore: e.target.checked })} className="h-4 w-4 accent-blue-500" />
                    </label>
                    <div className="flex items-center gap-2 text-[11px] text-slate-300">
                      about
                      <select value={p.leadMinutes} onChange={(e) => update({ leadMinutes: Number(e.target.value) })} className={select} aria-label="How long before">
                        {[15, 30, 60, 90, 120, 180].map((m) => (
                          <option key={m} value={m}>
                            {m >= 60 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} minutes`}
                          </option>
                        ))}
                      </select>
                      before
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2">
                  <p className="text-xs text-slate-100 font-medium">Remind me about</p>
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
                    {CATEGORIES.map((c) => (
                      <label key={c.key} className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                        <input type="checkbox" checked={Boolean(p[c.key])} onChange={(e) => update({ [c.key]: e.target.checked } as Partial<Prefs>)} className="h-4 w-4 mt-0.5 accent-blue-500 shrink-0" />
                        <span>
                          {c.label}
                          <span className="block text-[11px] text-slate-400">{c.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 grid sm:grid-cols-2 gap-3 text-[11px] text-slate-300">
                  <div className="flex items-center gap-2 flex-wrap">
                    Quiet hours: none from
                    <select value={p.quietStart} onChange={(e) => update({ quietStart: Number(e.target.value) })} className={select} aria-label="Quiet hours start">
                      {hours.map((h) => (
                        <option key={h} value={h}>
                          {hourLabel(h)}
                        </option>
                      ))}
                    </select>
                    to
                    <select value={p.quietEnd} onChange={(e) => update({ quietEnd: Number(e.target.value) })} className={select} aria-label="Quiet hours end">
                      {hours.map((h) => (
                        <option key={h} value={h}>
                          {hourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    “Due today” on all-day items at
                    <select value={p.morningHour} onChange={(e) => update({ morningHour: Number(e.target.value) })} className={select} aria-label="Morning reminder time">
                      {hours.filter((h) => h >= 5 && h <= 12).map((h) => (
                        <option key={h} value={h}>
                          {hourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="sm:col-span-2 text-slate-400">Quiet hours hold back the evening-before and morning messages. “Shortly before” messages and your own reminders always arrive.</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
