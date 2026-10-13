"use client";

import { useState, useEffect } from "react";
import {
  Wrench,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Loader2,
  Laptop,
  Home,
  Code2,
  UserCheck,
  Edit3,
  Trash2,
  X,
  Search,
  AlertCircle,
  Calendar,
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

const AREA_OPTIONS = [
  { value: "COMPUTER", label: "Computer / Tech" },
  { value: "HOME", label: "Home / Workspace" },
  { value: "DEV", label: "Dev & Repositories" },
  { value: "PERSONAL_ADMIN", label: "Personal Admin" },
];

const CADENCE_PRESETS = [
  { value: "7", label: "Weekly (7d)" },
  { value: "14", label: "Bi-weekly (14d)" },
  { value: "30", label: "Monthly (30d)" },
  { value: "60", label: "Bi-monthly (60d)" },
  { value: "90", label: "Quarterly (90d)" },
  { value: "180", label: "Semi-annual (180d)" },
  { value: "365", label: "Annual (365d)" },
];

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Maintenance Task Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("COMPUTER");
  const [frequencyDays, setFrequencyDays] = useState("14");
  const [nextDueAt, setNextDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Maintenance Task Modal State
  const [editingItem, setEditingItem] = useState<MaintenanceItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArea, setEditArea] = useState("COMPUTER");
  const [editFrequencyDays, setEditFrequencyDays] = useState("14");
  const [editNextDueAt, setEditNextDueAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<MaintenanceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/maintenance", { cache: "no-store" });
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

  const showFeedback = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // 1. Complete action
  const handleComplete = async (item: MaintenanceItem) => {
    try {
      const res = await fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "COMPLETE" }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`Completed "${item.title}". Next check scheduled in ${item.frequencyDays} days.`);
        fetchItems();
      }
    } catch (e) {
      console.error("Failed to complete maintenance:", e);
    }
  };

  // 2. Create action
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
          frequencyDays: parseInt(frequencyDays, 10) || 14,
          nextDueAt: nextDueAt || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setNotes("");
        setNextDueAt("");
        setArea("COMPUTER");
        setFrequencyDays("14");
        setShowCreateModal(false);
        showFeedback(`Created recurring task "${data.item.title}".`);
        fetchItems();
      }
    } catch (e) {
      console.error("Failed to create maintenance item:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Open Edit Modal
  const openEditModal = (item: MaintenanceItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingItem(item);
    setEditTitle(item.title);
    setEditArea(item.area);
    setEditFrequencyDays(item.frequencyDays.toString());
    setEditNextDueAt(
      item.nextDueAt ? new Date(item.nextDueAt).toISOString().split("T")[0] : ""
    );
    setEditNotes(item.notes || "");
  };

  // 4. Update action
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          action: "EDIT",
          title: editTitle.trim(),
          area: editArea,
          frequencyDays: parseInt(editFrequencyDays, 10) || 14,
          nextDueAt: editNextDueAt || null,
          notes: editNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingItem(null);
        showFeedback(`Updated "${data.item.title}".`);
        fetchItems();
      }
    } catch (e) {
      console.error("Failed to update maintenance item:", e);
    } finally {
      setIsUpdating(false);
    }
  };

  // 5. Delete action
  const handleDelete = async () => {
    if (!deleteConfirmItem || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/maintenance?id=${deleteConfirmItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        const deletedTitle = deleteConfirmItem.title;
        setDeleteConfirmItem(null);
        showFeedback(`Deleted "${deletedTitle}".`);
        fetchItems();
      }
    } catch (e) {
      console.error("Failed to delete maintenance item:", e);
    } finally {
      setIsDeleting(false);
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

  const filteredItems = items.filter((item) => {
    if (areaFilter !== "ALL" && item.area !== areaFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      return matchTitle || matchNotes;
    }
    return true;
  });

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
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Hygiene Task</span>
        </button>
      </div>

      {/* Action Message Feedback */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Search and Area Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search maintenance routines by title or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Area Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {["ALL", "COMPUTER", "HOME", "DEV", "PERSONAL_ADMIN"].map((tab) => {
              const count =
                tab === "ALL"
                  ? items.length
                  : items.filter((i) => i.area === tab).length;

              const label =
                tab === "ALL"
                  ? "All"
                  : tab === "COMPUTER"
                  ? "Computer"
                  : tab === "HOME"
                  ? "Home"
                  : tab === "DEV"
                  ? "Dev"
                  : "Personal Admin";

              return (
                <button
                  key={tab}
                  onClick={() => setAreaFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    areaFilter === tab
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold"
                      : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Maintenance Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Checking maintenance cadence...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 p-8 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <p>No hygiene tasks found matching your filter.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create a new hygiene routine</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-4 transition-all group/card"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getAreaIcon(item.area)}
                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                      {item.area}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                    <button
                      onClick={(e) => openEditModal(item, e)}
                      title="Edit Task"
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmItem(item);
                      }}
                      title="Delete Task"
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-100 group-hover/card:text-blue-300 transition-colors">
                  {item.title}
                </h3>
                {item.notes && (
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                    {item.notes}
                  </p>
                )}

                <div className="space-y-1 text-[11px] font-mono text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span>Interval: Every {item.frequencyDays} days</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-slate-500" />
                    <span>Next Due: {formatDate(item.nextDueAt)}</span>
                  </div>
                  {item.lastCompletedAt && (
                    <div className="text-slate-600 pl-4.5">
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 group-hover:text-white" />
                  <span>Mark Done & Reset Timer</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MAINTENANCE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-400" />
                Create Recurring Maintenance Task
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Area</label>
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {AREA_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Interval (Days)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 14"
                    value={frequencyDays}
                    onChange={(e) => setFrequencyDays(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Cadence quick preset chips */}
              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-mono">Common Cadences:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CADENCE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFrequencyDays(p.value)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                        frequencyDays === p.value
                          ? "bg-blue-600 text-white border-blue-500 font-semibold"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">
                  Initial Next Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={nextDueAt}
                  onChange={(e) => setNextDueAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Notes & Instructions (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Details, checklist items, or links"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
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

      {/* EDIT MAINTENANCE TASK MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-400" />
                Edit Maintenance Task
              </h2>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Task Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Area</label>
                  <select
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {AREA_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Interval (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={editFrequencyDays}
                    onChange={(e) => setEditFrequencyDays(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Cadence quick preset chips for edit */}
              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-mono">Common Cadences:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CADENCE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditFrequencyDays(p.value)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                        editFrequencyDays === p.value
                          ? "bg-blue-600 text-white border-blue-500 font-semibold"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Next Due Date</label>
                <input
                  type="date"
                  value={editNextDueAt}
                  onChange={(e) => setEditNextDueAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Notes & Instructions (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Details, checklist items, or links"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim() || isUpdating}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MAINTENANCE TASK CONFIRMATION MODAL */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Hygiene Task?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteConfirmItem.title}&quot;</strong>?
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              This recurring hygiene cadence will be permanently removed from your maintenance schedule.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
