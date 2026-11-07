"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Circle,
  MapPin,
  CheckSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  CalendarDays,
  ListFilter,
  Rows3,
  Sparkles,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

import { offlineFetch, isOnline } from "@/lib/offlineSync";
import { addDaysKey, dayKey, lateLabel, timeInputValue, timeLabel, weekStartKey, whenLabel, zonedInstant } from "@/lib/dates";
import type { AgendaCategory, AgendaItem } from "@/lib/agenda";

interface ConnectedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface ConnectedNote {
  id: string;
  title: string;
}

type ViewMode = "MONTH" | "WEEK" | "AGENDA";
type Filter = "ALL" | AgendaCategory;

const CATEGORY: Record<AgendaCategory, { label: string; dot: string; chip: string; card: string }> = {
  EVENT: { label: "Events", dot: "bg-blue-400", chip: "bg-blue-500/20 text-blue-200 border-blue-500/30", card: "border-blue-500/30" },
  REMINDER: { label: "Reminders", dot: "bg-violet-400", chip: "bg-violet-500/20 text-violet-200 border-violet-500/30", card: "border-violet-500/30" },
  TASK: { label: "Tasks", dot: "bg-emerald-400", chip: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30", card: "border-emerald-500/30" },
  ACADEMIC: { label: "Academic", dot: "bg-amber-400", chip: "bg-amber-500/20 text-amber-200 border-amber-500/30", card: "border-amber-500/30" },
  CLASS: { label: "Classes", dot: "bg-cyan-400", chip: "bg-cyan-500/20 text-cyan-200 border-cyan-500/30", card: "border-cyan-500/30" },
  MAINTENANCE: { label: "Maintenance", dot: "bg-orange-400", chip: "bg-orange-500/20 text-orange-200 border-orange-500/30", card: "border-orange-500/30" },
  BUSINESS: { label: "Business", dot: "bg-fuchsia-400", chip: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/30", card: "border-fuchsia-500/30" },
};
const CATEGORY_ORDER: AgendaCategory[] = ["EVENT", "TASK", "ACADEMIC", "CLASS", "REMINDER", "MAINTENANCE", "BUSINESS"];

type Status = "DONE" | "PAST" | "NOW" | "UPCOMING" | "OVERDUE" | "DUE TODAY" | "ALL DAY";
const STATUS_CLASS: Record<Status, string> = {
  DONE: "text-slate-400",
  PAST: "text-slate-400",
  NOW: "text-emerald-300",
  UPCOMING: "text-blue-300",
  OVERDUE: "text-rose-300",
  "DUE TODAY": "text-amber-300",
  "ALL DAY": "text-slate-300",
};

/** Where an item stands right now: finished, in progress, late or still ahead. */
function statusOf(i: AgendaItem, nowMs: number, todayKey: string): Status {
  if (i.done) return "DONE";
  const start = new Date(i.start).getTime();
  const key = dayKey(new Date(i.start));
  const timedSource = i.source === "EVENT" || i.source === "CLASS" || i.source === "ZOOM" || i.source === "CAT";
  if (timedSource) {
    if (i.allDay) return key === todayKey ? "ALL DAY" : key < todayKey ? "PAST" : "UPCOMING";
    const end = i.end ? new Date(i.end).getTime() : start;
    if (end < nowMs) return "PAST";
    if (start <= nowMs) return "NOW";
    return "UPCOMING";
  }
  if (key < todayKey) return "OVERDUE";
  if (key === todayKey) return i.allDay || start >= nowMs ? "DUE TODAY" : "OVERDUE";
  return "UPCOMING";
}

function timeOf(i: AgendaItem): string {
  if (i.allDay) return "All day";
  return i.end && (i.source === "EVENT" || i.source === "CLASS" || i.source === "ZOOM" || i.source === "CAT")
    ? `${timeLabel(i.start)} – ${timeLabel(i.end)}`
    : timeLabel(i.start);
}

export default function CalendarPage() {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const todayKey = dayKey(now);

  const [cursor, setCursor] = useState(() => dayKey(new Date())); // any day inside the month/week on screen
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>("MONTH");
  const [filter, setFilter] = useState<Filter>("ALL");

  const [items, setItems] = useState<AgendaItem[]>([]);
  const [overdue, setOverdue] = useState<AgendaItem[]>([]);
  const [availableTasks, setAvailableTasks] = useState<ConnectedTask[]>([]);
  const [availableNotes, setAvailableNotes] = useState<ConnectedNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [briefingOpen, setBriefingOpen] = useState(true);

  // Add / edit modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalItemType, setModalItemType] = useState<"EVENT" | "REMINDER">("EVENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemDate, setItemDate] = useState(() => dayKey(new Date()));
  const [itemTime, setItemTime] = useState("09:00");
  const [itemEndTime, setItemEndTime] = useState("10:00");
  const [itemLocation, setItemLocation] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; itemType: "EVENT" | "REMINDER" } | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; itemType: "EVENT" | "REMINDER" } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const monthKey = cursor.slice(0, 7);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      setBriefingOpen(localStorage.getItem("faida_cal_briefing") !== "closed");
    } catch {}
  }, []);

  const loadData = useCallback(
    async (patient = false) => {
      const wait = patient ? { waitMs: 25000 } : {};
      try {
        const [agendaRes, calRes] = await Promise.all([
          offlineFetch(`/api/agenda?month=${monthKey}`, { cache: "no-store", ...wait }),
          offlineFetch(`/api/calendar?month=${monthKey}`, { cache: "no-store", ...wait }),
        ]);
        const agenda = await agendaRes.json();
        if (agenda.success) {
          setItems(agenda.items || []);
          setOverdue(agenda.overdue || []);
        }
        const cal = await calRes.json();
        if (cal.success) {
          setAvailableTasks(cal.availableTasks || []);
          setAvailableNotes(cal.availableNotes || []);
        }
      } catch (e) {
        console.error("Failed to load calendar data:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [monthKey]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- navigation ------------------------------------------------------------------------------
  const goPrev = () => {
    if (viewMode === "WEEK") {
      const k = addDaysKey(cursor, -7);
      setCursor(k);
      setSelectedDay(k);
    } else {
      const [y, m] = cursor.split("-").map(Number);
      const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
      setCursor(prev);
    }
  };
  const goNext = () => {
    if (viewMode === "WEEK") {
      const k = addDaysKey(cursor, 7);
      setCursor(k);
      setSelectedDay(k);
    } else {
      const [y, m] = cursor.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      setCursor(next);
    }
  };
  const goToday = () => {
    setCursor(todayKey);
    setSelectedDay(todayKey);
  };

  // ---- derived data ------------------------------------------------------------------------------
  const visible = useMemo(() => items.filter((i) => filter === "ALL" || i.category === filter), [items, filter]);
  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const i of visible) {
      const k = dayKey(new Date(i.start));
      (map.get(k) || map.set(k, []).get(k)!).push(i);
    }
    // all-day first, then by time
    map.forEach((list) => list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)));
    return map;
  }, [visible]);

  const countsByCategory = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) {
      if (dayKey(new Date(i.start)).slice(0, 7) !== monthKey) continue;
      c[i.category] = (c[i.category] || 0) + 1;
    }
    return c;
  }, [items, monthKey]);
  const monthTotal = Object.values(countsByCategory).reduce((a, b) => a + b, 0);

  const todaysItems = useMemo(() => (byDay.get(todayKey) || []).slice(), [byDay, todayKey]);
  const lateItems = useMemo(() => overdue.filter((i) => !i.done && (filter === "ALL" || i.category === filter)), [overdue, filter]);

  const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthKey}-01T12:00:00Z`));
  const weekStart = weekStartKey(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const periodTitle =
    viewMode === "WEEK"
      ? `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${weekDays[0]}T12:00:00Z`))} – ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${weekDays[6]}T12:00:00Z`))}`
      : monthTitle;

  const monthCells = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1, 12));
    const startOffset = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: (string | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= count; d++) cells.push(`${monthKey}-${String(d).padStart(2, "0")}`);
    return cells;
  }, [monthKey]);

  const dayLabel = (k: string) => {
    if (k === todayKey) return "Today";
    if (k === addDaysKey(todayKey, 1)) return "Tomorrow";
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${k}T12:00:00Z`));
  };
  const selectedItems = byDay.get(selectedDay) || [];

  // ---- actions -----------------------------------------------------------------------------------
  const openAdd = (dateKey?: string) => {
    setEditingItem(null);
    setModalItemType("EVENT");
    setTitle("");
    setDescription("");
    setItemLocation("");
    setSelectedTaskId("");
    setSelectedNoteId("");
    setItemDate(dateKey || selectedDay || todayKey);
    setShowAddModal(true);
  };

  const openEdit = (raw: any, type: "EVENT" | "REMINDER") => {
    setEditingItem({ id: raw.id, itemType: type });
    setModalItemType(type);
    setTitle(raw.title);
    setDescription(raw.description || "");
    setSelectedTaskId(raw.taskId || "");
    setSelectedNoteId(raw.noteId || "");
    if (type === "EVENT") {
      setItemDate(dayKey(new Date(raw.startTime)));
      setItemTime(timeInputValue(raw.startTime));
      setItemEndTime(timeInputValue(raw.endTime));
      setItemLocation(raw.location || "");
      setIsAllDay(raw.isAllDay || false);
    } else {
      setItemDate(dayKey(new Date(raw.dueAt)));
      setItemTime(timeInputValue(raw.dueAt));
    }
    setShowAddModal(true);
  };

  const openItem = (i: AgendaItem) => {
    if (i.canEdit && i.raw) return openEdit(i.raw, i.source === "EVENT" ? "EVENT" : "REMINDER");
    if (i.url) return void window.open(i.url, "_blank", "noopener,noreferrer");
    if (i.href) router.push(i.href);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // What was typed is Nairobi time; send the real instant so it never shifts by the server's time zone.
      const startISO = zonedInstant(itemDate, itemTime).toISOString();
      const endISO = zonedInstant(itemDate, itemEndTime).toISOString();
      const body: any = {
        itemType: modalItemType,
        title: title.trim(),
        description: description.trim() || null,
        taskId: selectedTaskId || null,
        noteId: selectedNoteId || null,
      };
      if (modalItemType === "EVENT") {
        body.startTime = startISO;
        body.endTime = endISO;
        body.location = itemLocation || null;
        body.isAllDay = isAllDay;
      } else if (editingItem) {
        body.dueAt = startISO;
      } else {
        body.date = startISO;
      }
      if (editingItem) body.id = editingItem.id;

      const res = await offlineFetch("/api/calendar", {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setEditingItem(null);
        setTitle("");
        setDescription("");
        setItemLocation("");
        setSelectedTaskId("");
        setSelectedNoteId("");
        if (isOnline()) loadData(true);
      }
    } catch (err) {
      console.error("Failed to save calendar item:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleItem = async (i: AgendaItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!i.canToggle) return;
    const nextDone = !i.done;
    // Show the change at once; offline it is also saved and sent later.
    const reduce = (list: AgendaItem[]) =>
      i.source === "MAINTENANCE" ? list.filter((x) => x.key !== i.key) : list.map((x) => (x.key === i.key ? { ...x, done: nextDone } : x));
    setItems(reduce);
    setOverdue((list) => (nextDone || i.source === "MAINTENANCE" ? list.filter((x) => x.key !== i.key) : list));

    try {
      if (i.source === "REMINDER") {
        await offlineFetch("/api/calendar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: i.id, itemType: "REMINDER", isCompleted: nextDone }),
        });
      } else if (i.source === "TASK") {
        await offlineFetch(`/api/tasks/${i.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextDone ? "DONE" : "TODO" }),
        });
      } else if (i.source === "DELIVERABLE") {
        await offlineFetch("/api/business/deliverables", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: i.id, status: nextDone ? "COMPLETED" : "PENDING" }),
        });
      } else if (i.source === "MAINTENANCE") {
        await offlineFetch("/api/maintenance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: i.id, action: "COMPLETE" }),
        });
      }
      if (isOnline()) loadData(true);
    } catch (err) {
      console.error("Failed to update item:", err);
      loadData(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await offlineFetch(`/api/calendar?id=${deleteConfirm.id}&itemType=${deleteConfirm.itemType}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm(null);
        if (isOnline()) loadData(true);
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeBriefing = () => {
    setBriefingOpen(false);
    try {
      localStorage.setItem("faida_cal_briefing", "closed");
    } catch {}
  };
  const openBriefing = () => {
    setBriefingOpen(true);
    try {
      localStorage.removeItem("faida_cal_briefing");
    } catch {}
  };

  // ---- small pieces ------------------------------------------------------------------------------
  const StatusText = ({ i }: { i: AgendaItem }) => {
    const st = statusOf(i, now.getTime(), todayKey);
    return <span className={`text-[10px] font-bold uppercase tracking-wide ${STATUS_CLASS[st]}`}>{st === "OVERDUE" ? `Overdue · ${lateLabel(i.start, now)}` : st}</span>;
  };

  const Row = ({ i, showDate = false }: { i: AgendaItem; showDate?: boolean }) => {
    const cat = CATEGORY[i.category];
    return (
      <div
        onClick={() => openItem(i)}
        className={`p-3 rounded-xl bg-slate-950/60 border ${cat.card} hover:bg-slate-900/80 transition-colors flex items-start gap-3 ${i.href || i.url || i.canEdit ? "cursor-pointer" : ""}`}
      >
        {i.canToggle ? (
          <button
            onClick={(e) => toggleItem(i, e)}
            aria-label={i.done ? "Mark not done" : "Mark done"}
            className="mt-0.5 shrink-0 text-slate-400 hover:text-white"
          >
            {i.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4" />}
          </button>
        ) : (
          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${cat.dot}`} />
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <StatusText i={i} />
            <span className="text-[11px] text-slate-400 font-mono">
              {showDate ? `${whenLabel(i.start, true, now)} · ` : ""}
              {timeOf(i)}
            </span>
          </div>
          <p className={`text-xs font-semibold break-words ${i.done ? "line-through text-slate-400" : "text-slate-100"}`}>{i.title}</p>
          {i.subtitle && (
            <p className="text-[11px] text-slate-400 break-words flex items-center gap-1">
              {i.source === "EVENT" && <MapPin className="h-3 w-3 shrink-0" />}
              {i.subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {i.url && (
            <a
              href={i.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label="Open link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {i.canEdit && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(i.raw, i.source === "EVENT" ? "EVENT" : "REMINDER");
                }}
                aria-label="Edit"
                className="p-1.5 rounded-lg text-slate-300 hover:text-blue-300 hover:bg-slate-800"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({ id: i.id, title: i.title, itemType: i.source === "EVENT" ? "EVENT" : "REMINDER" });
                }}
                aria-label="Delete"
                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const Chip = ({ i }: { i: AgendaItem }) => {
    const cat = CATEGORY[i.category];
    const st = statusOf(i, now.getTime(), todayKey);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          openItem(i);
        }}
        title={`${i.title} · ${timeOf(i)}`}
        className={`w-full text-left truncate text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${cat.chip} ${
          i.done || st === "PAST" ? "opacity-55 line-through" : ""
        } ${st === "OVERDUE" ? "ring-1 ring-rose-400/60" : ""}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cat.dot}`} />
        <span className="truncate">{i.title}</span>
      </button>
    );
  };

  const longToday = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Nairobi" }).format(now);
  // Overdue first, then today's list; an item that is both (a reminder that passed an hour ago) shows once.
  const briefingCards = Array.from(
    new Map([...lateItems.slice(0, 2), ...todaysItems.filter((i) => !i.done || todaysItems.length <= 4)].map((i) => [i.key, i])).values()
  ).slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            Execution & Chrono Planning
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">Scheduler & Calendar</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            One timeline for events, reminders, tasks, university work, classes, maintenance and business deliverables.
          </p>
        </div>

        <button
          onClick={() => openAdd()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/10 cursor-pointer transition-all whitespace-nowrap shrink-0 w-fit"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Event / Reminder</span>
        </button>
      </div>

      {/* Today's briefing */}
      {briefingOpen ? (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-300 shrink-0" />
                <span className="break-words">Briefing: {longToday}</span>
              </h2>
              <p className="text-[11px] text-slate-300 mt-1">
                {todaysItems.length} on today
                {lateItems.length > 0 && <span className="text-rose-300"> · {lateItems.length} overdue</span>}
                {todaysItems.filter((i) => i.done).length > 0 && ` · ${todaysItems.filter((i) => i.done).length} done`}
              </p>
            </div>
            <button onClick={closeBriefing} aria-label="Hide briefing" className="p-1 text-slate-400 hover:text-white shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {briefingCards.length === 0 ? (
            <p className="text-xs text-slate-300 py-3 border-t border-slate-800/80">Nothing is scheduled today and nothing is overdue.</p>
          ) : (
            <div className="grid grid-flow-col auto-cols-[78%] sm:auto-cols-[44%] lg:auto-cols-[calc(25%-0.6rem)] gap-3 overflow-x-auto pb-1 pt-3 border-t border-slate-800/80">
              {briefingCards.map((i) => {
                const st = statusOf(i, now.getTime(), todayKey);
                const cat = CATEGORY[i.category];
                return (
                  <div
                    key={i.key}
                    onClick={() => openItem(i)}
                    className={`rounded-xl border p-3 space-y-1 bg-slate-950/50 ${st === "OVERDUE" ? "border-rose-500/40" : cat.card} ${
                      i.href || i.url || i.canEdit ? "cursor-pointer hover:bg-slate-900/70" : ""
                    } ${i.done || st === "PAST" ? "opacity-70" : ""}`}
                  >
                    <p className="text-[11px] font-mono">
                      <span className="text-slate-300">{timeOf(i)}</span> <span className={`font-bold ${STATUS_CLASS[st]}`}>({st === "OVERDUE" ? `OVERDUE ${lateLabel(i.start, now)}` : st})</span>
                    </p>
                    <p className="text-xs font-bold text-slate-100 break-words">{i.title}</p>
                    {i.subtitle && <p className="text-[11px] text-slate-400 break-words line-clamp-2">{i.subtitle}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <button onClick={openBriefing} className="text-xs text-blue-300 hover:underline flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Show today&apos;s briefing
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        {/* MAIN */}
        <div className="space-y-4 min-w-0">
          {/* Toolbar */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white break-words">{periodTitle}</h2>
                <button onClick={goPrev} aria-label="Previous" className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={goNext} aria-label="Next" className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-slate-950 border border-slate-800 p-1">
                  {(
                    [
                      ["MONTH", "Month", CalendarDays],
                      ["WEEK", "Week", Rows3],
                      ["AGENDA", "Agenda", ListFilter],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => setViewMode(id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        viewMode === id ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs text-slate-200 hover:text-white bg-slate-800 border border-slate-700 font-medium whitespace-nowrap">
                  Today
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                onClick={() => setFilter("ALL")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap shrink-0 ${
                  filter === "ALL" ? "bg-blue-600 text-white border-blue-400/50" : "bg-slate-950/60 text-slate-300 border-slate-700 hover:text-white"
                }`}
              >
                All <span className="opacity-70">{monthTotal}</span>
              </button>
              {CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(filter === c ? "ALL" : c)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap shrink-0 ${
                    filter === c ? `${CATEGORY[c].chip} ring-1 ring-white/20` : "bg-slate-950/60 text-slate-300 border-slate-700 hover:text-white"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY[c].dot}`} />
                  {CATEGORY[c].label} <span className="opacity-70">{countsByCategory[c] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          {isLoading && items.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-10 text-center text-xs text-slate-300">Loading your schedule…</div>
          ) : viewMode === "MONTH" ? (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60 text-center text-[11px] font-semibold text-slate-300 py-2.5 uppercase tracking-wider">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-800/50">
                {monthCells.map((k, idx) => {
                  if (!k) return <div key={`empty-${idx}`} className="bg-slate-950/40 min-h-[4.5rem] sm:min-h-28 p-2" />;
                  const list = byDay.get(k) || [];
                  const isToday = k === todayKey;
                  const isSelected = k === selectedDay;
                  const late = list.filter((i) => statusOf(i, now.getTime(), todayKey) === "OVERDUE").length;
                  return (
                    <div
                      key={k}
                      onClick={() => setSelectedDay(k)}
                      className={`bg-slate-900/90 min-h-[4.5rem] sm:min-h-28 p-1.5 sm:p-2 transition-colors cursor-pointer flex flex-col gap-1 ${
                        isToday ? "ring-1 ring-blue-500/50 bg-blue-950/10" : ""
                      } ${isSelected ? "bg-slate-800/80 ring-2 ring-blue-500" : "hover:bg-slate-800/50"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono font-semibold rounded-full h-5 min-w-5 px-1 flex items-center justify-center ${isToday ? "bg-blue-600 text-white" : "text-slate-300"}`}>
                          {Number(k.slice(8))}
                        </span>
                        {late > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" title={`${late} overdue`} />}
                      </div>
                      {/* phones: dots only; larger screens: titles */}
                      <div className="hidden sm:block space-y-1 overflow-hidden">
                        {list.slice(0, 3).map((i) => (
                          <Chip key={i.key} i={i} />
                        ))}
                        {list.length > 3 && <span className="text-[10px] text-slate-400 font-mono block pl-1">+{list.length - 3} more</span>}
                      </div>
                      <div className="sm:hidden flex flex-wrap gap-0.5">
                        {list.slice(0, 6).map((i) => (
                          <span key={i.key} className={`h-1.5 w-1.5 rounded-full ${CATEGORY[i.category].dot}`} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === "WEEK" ? (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((k) => {
                const list = byDay.get(k) || [];
                const isToday = k === todayKey;
                return (
                  <div
                    key={k}
                    onClick={() => setSelectedDay(k)}
                    className={`rounded-xl bg-slate-900/60 border p-2.5 space-y-2 min-h-24 cursor-pointer ${
                      isToday ? "border-blue-500/50" : "border-slate-800"
                    } ${k === selectedDay ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <div className="flex md:flex-col md:items-start items-center justify-between gap-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? "text-blue-300" : "text-slate-300"}`}>
                        {new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${k}T12:00:00Z`))}
                      </span>
                      <span className={`text-sm font-bold ${isToday ? "text-white" : "text-slate-200"}`}>{Number(k.slice(8))}</span>
                    </div>
                    {list.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Free</p>
                    ) : (
                      <div className="space-y-1.5">
                        {list.map((i) => (
                          <button
                            key={i.key}
                            onClick={(e) => {
                              e.stopPropagation();
                              openItem(i);
                            }}
                            className={`w-full text-left rounded-lg border px-2 py-1.5 ${CATEGORY[i.category].chip} ${i.done ? "opacity-55" : ""}`}
                          >
                            <span className="block text-[10px] font-mono opacity-80">{timeOf(i)}</span>
                            <span className={`block text-[11px] font-semibold break-words ${i.done ? "line-through" : ""}`}>{i.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-5">
              {(() => {
                const keys = Array.from(byDay.keys())
                  .filter((k) => k.slice(0, 7) === monthKey)
                  .sort();
                if (keys.length === 0)
                  return <div className="py-12 text-center text-xs text-slate-400">Nothing scheduled this month for this filter.</div>;
                return keys.map((k) => (
                  <div key={k} className="space-y-2">
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider ${k === todayKey ? "text-blue-300" : "text-slate-300"}`}>{dayLabel(k)}</h3>
                    <div className="space-y-2">
                      {(byDay.get(k) || []).map((i) => (
                        <Row key={i.key} i={i} />
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-4 min-w-0">
          {lateItems.length > 0 && (
            <div className="rounded-2xl bg-slate-900/60 border border-rose-500/30 p-4 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-300" />
                Needs attention ({lateItems.length})
              </h2>
              <div className="space-y-2">
                {lateItems.slice(0, 6).map((i) => (
                  <Row key={i.key} i={i} showDate />
                ))}
                {lateItems.length > 6 && <p className="text-[11px] text-slate-400">+{lateItems.length - 6} more overdue</p>}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white">{dayLabel(selectedDay)}</h2>
                <p className="text-[11px] text-slate-400">
                  {selectedItems.length} scheduled · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${selectedDay}T12:00:00Z`))}
                </p>
              </div>
              <button
                onClick={() => openAdd(selectedDay)}
                aria-label="Add to this day"
                className="p-1.5 rounded-lg text-slate-200 hover:text-white bg-slate-800 border border-slate-700 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {selectedItems.length === 0 ? (
              <p className="text-xs text-slate-300 py-6 text-center border border-dashed border-slate-800 rounded-xl">Nothing scheduled. A free day to get ahead.</p>
            ) : (
              <div className="space-y-2">
                {selectedItems.map((i) => (
                  <Row key={i.key} i={i} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">What feeds this calendar</h2>
            <div className="space-y-2 text-[11px] text-slate-300">
              {[
                { c: "EVENT" as const, t: "Events you schedule here", href: null },
                { c: "TASK" as const, t: "Task deadlines", href: "/tasks" },
                { c: "ACADEMIC" as const, t: "Assignments & CATs from your LMS", href: "/university" },
                { c: "CLASS" as const, t: "Weekly timetable & live class links", href: "/university" },
                { c: "REMINDER" as const, t: "Reminders", href: null },
                { c: "MAINTENANCE" as const, t: "Maintenance due dates", href: "/maintenance" },
                { c: "BUSINESS" as const, t: "Business deliverables", href: "/business" },
              ].map((r) => (
                <div key={r.c} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${CATEGORY[r.c].dot}`} />
                  <span className="flex-1 min-w-0 break-words">{r.t}</span>
                  <span className="font-mono text-slate-400">{countsByCategory[r.c] || 0}</span>
                  {r.href && (
                    <Link href={r.href} className="text-blue-300 hover:underline whitespace-nowrap">
                      Open
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ADD / EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-400" />
                {editingItem ? "Edit Schedule Item" : "Schedule Event or Reminder"}
              </h2>
              <button onClick={() => setShowAddModal(false)} aria-label="Close" className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              {!editingItem && (
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalItemType("EVENT")}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                      modalItemType === "EVENT" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Calendar Event
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalItemType("REMINDER")}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                      modalItemType === "REMINDER" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Reminder
                  </button>
                </div>
              )}

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Title</label>
                <input
                  type="text"
                  placeholder={modalItemType === "EVENT" ? "e.g. System Design Sync with Team" : "e.g. Pay Internet Bill"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Date</label>
                  <input
                    type="date"
                    value={itemDate}
                    onChange={(e) => setItemDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">{modalItemType === "EVENT" ? "Start Time" : "Due Time"}</label>
                  <input
                    type="time"
                    value={itemTime}
                    onChange={(e) => setItemTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
              </div>

              {modalItemType === "EVENT" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1 font-medium">End Time</label>
                    <input
                      type="time"
                      value={itemEndTime}
                      onChange={(e) => setItemEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1 font-medium">Location</label>
                    <input
                      type="text"
                      placeholder="Google Meet, Office, Nairobi"
                      value={itemLocation}
                      onChange={(e) => setItemLocation(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-300 mb-1 font-medium flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 text-purple-400" />
                  <span>Connect to Task (Optional)</span>
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">No task connection</option>
                  {availableTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.priority})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 mb-1 font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  <span>Connect to Note (Optional)</span>
                </label>
                <select
                  value={selectedNoteId}
                  onChange={(e) => setSelectedNoteId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">No note connection</option>
                  {availableNotes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Description / Details</label>
                <textarea
                  rows={3}
                  placeholder="Additional context, agenda points, or checklist..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : editingItem ? "Save Changes" : "Schedule Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-white">Delete Item?</h3>
            </div>
            <p className="text-xs text-slate-300 break-words">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteConfirm.title}&quot;</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
