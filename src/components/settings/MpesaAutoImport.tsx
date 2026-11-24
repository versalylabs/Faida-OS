"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Smartphone, Trash2 } from "lucide-react";

interface Status {
  active: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
  pending: number;
}

/**
 * Settings > M-Pesa auto-import. Creates the private key the phone uses to forward M-Pesa SMS, and shows the
 * values to paste into MacroDroid. The key is shown once; creating a new one switches the old one off.
 */
export function MpesaAutoImport() {
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ingest/key", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setStatus(json);
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (status?.active && !confirm("Make a new key? The one on your phone stops working until you paste the new one in.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ingest/key", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setKey(json.key);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!confirm("Turn off M-Pesa auto-import? Your phone's messages will no longer be accepted.")) return;
    setBusy(true);
    try {
      await fetch("/api/ingest/key", { method: "DELETE" });
      setKey(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard blocked: the value is on screen to copy by hand
    }
  };

  const url = typeof window === "undefined" ? "/api/ingest/mpesa" : `${window.location.origin}/api/ingest/mpesa`;

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">
        <code className="flex-1 text-xs text-slate-200 break-all">{value}</code>
        <button onClick={() => copy(label, value)} className="text-slate-300 hover:text-white p-1 cursor-pointer shrink-0" title={`Copy ${label}`}>
          {copied === label ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );

  return (
    <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4" aria-labelledby="mpesa-heading">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-emerald-400" />
          <h2 id="mpesa-heading" className="text-sm font-semibold text-slate-100">M-Pesa auto-import</h2>
          {status?.active && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-200 border border-emerald-300/30">On</span>}
        </div>
        {status?.active && (
          <span className="text-xs text-slate-400">
            {status.lastUsedAt ? `Last message ${new Date(status.lastUsedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "No messages received yet"}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Your Android phone forwards every M-Pesa SMS to Faida, so spending and income are logged with no typing. They land on the Finance page under
        &ldquo;To check&rdquo;, and an evening reminder lets you confirm them in one tap. Each message is logged once, even if it is sent twice.
      </p>

      {key ? (
        <div className="space-y-3 p-4 rounded-2xl bg-slate-950/40 border border-emerald-300/30">
          <p className="text-xs text-emerald-100">Copy these into MacroDroid now. The key is shown only this once.</p>
          <Field label="URL" value={url} />
          <Field label="Header" value={`Authorization: Bearer ${key}`} />
          <ol className="text-xs text-slate-300 space-y-1.5 list-decimal pl-4">
            <li>Install <b>MacroDroid</b> from the Play Store and allow it to read SMS when asked.</li>
            <li>Add Macro → Trigger: <b>SMS Received</b> → From: <b>MPESA</b> (any content).</li>
            <li>Action: <b>HTTP Request</b> → method <b>POST</b>, the URL above, add the header above, body type <b>Text</b>, body = the magic text <b>[sms_message]</b>.</li>
            <li>Save the macro, then send yourself a small amount (or wait for the next M-Pesa SMS) and check Finance.</li>
          </ol>
        </div>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={create}
          disabled={busy}
          className="press px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
          {status?.active ? "Make a new key" : "Set up on my phone"}
        </button>
        {status?.active && (
          <button
            onClick={turnOff}
            disabled={busy}
            className="press px-4 py-2 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Turn off
          </button>
        )}
        {status && status.pending > 0 && (
          <a href="/finance#review" className="link-chip is-alert">
            {status.pending} to check on the Finance page
          </a>
        )}
      </div>
    </section>
  );
}
