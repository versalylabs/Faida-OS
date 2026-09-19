"use client";

import { useState, useEffect } from "react";
import {
  Wrench,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Loader2,
  Sparkles,
  Laptop,
  Home,
  Code2,
  UserCheck,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface MaintenanceItem {
  id: string;
  title: string;
  area: string;
  frequencyDays: number;
  lastCompletedAt?: string | null;
  nextDueAt: string;
  notes?: string | null;
  status: "OVERDUE" | "DUE_SOON" | "ON_TRACK";
}

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New Maintenance Task Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("COMPUTER");
  const [frequencyDays, setFrequencyDays] = useState("14");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/maintenance");
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (e) {
      console.error("Failed to load maintenance items:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleComplete = async (item: MaintenanceItem) => {
    try {
      const res = await fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Completed "${item.title}". Next check scheduled in ${item.frequencyDays} days.`);
        setTimeout(() => setActionMessage(null), 4000);
        fetchItems();
      }
    } catch (e) {
      console.error("Failed to complete maintenance:", e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          area,
          frequencyDays: parseInt(frequencyDays, 10),
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setNotes("");
        setShowModal(false);
        fetchItems();
      }
    } catch (e) {
      console.error("Failed to create maintenance item:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAreaIcon = (a: string) => {
    switch (a) {
      case "COMPUTER":
        return <Laptop className="h-4 w-4 text-blue-400" />;
      case "HOME":
        return <Home className="h-4 w-4 text-amber-400" />;
      case "DEV":
        return <Code2 className="h-4 w-4 text-purple-400" />;
      default:
        return <UserCheck className="h-4 w-4 text-emerald-400" />;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "OVERDUE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "DUE_SOON":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <Wrench className="h-3.5 w-3.5" />
            Cadence & System Hygiene
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Personal & Digital Maintenance
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Recurring hygiene routines (computer, workspace, repositories) that reset on completion.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Hygiene Task</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Maintenance Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Checking maintenance cadence...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-4 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getAreaIcon(item.area)}
                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                      {item.area}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(
                      item.status
                    )}`}
                  >
                    {item.status.replace("_", " ")}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-100">{item.title}</h3>
                {item.notes && <p className="text-xs text-slate-400">{item.notes}</p>}

                <div className="space-y-1 text-[11px] font-mono text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span>Interval: Every {item.frequencyDays} days</span>
                  </div>
                  <div>Next Due: {formatDate(item.nextDueAt)}</div>
                  {item.lastCompletedAt && (
                    <div className="text-slate-600">
                      Last completed: {formatDate(item.lastCompletedAt)}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex justify-end">
                <button
                  onClick={() => handleComplete(item)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark Done & Reset Timer</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Maintenance Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-bold text-white">Create Recurring Maintenance Task</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Clean downloads, Review security keys, Change water filter"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Area</label>
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="COMPUTER">Computer</option>
                    <option value="HOME">Home</option>
                    <option value="DEV">Dev / Code</option>
                    <option value="PERSONAL_ADMIN">Personal Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Cadence</label>
                  <select
                    value={frequencyDays}
                    onChange={(e) => setFrequencyDays(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="7">Every 7 days (Weekly)</option>
                    <option value="14">Every 14 days (Bi-weekly)</option>
                    <option value="30">Every 30 days (Monthly)</option>
                    <option value="90">Every 90 days (Quarterly)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Details or specific checklist items"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Set Hygiene Cadence"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
