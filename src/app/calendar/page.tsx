"use client";

import { useState, useEffect } from "react";
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
  Loader2,
  X,
  AlertCircle,
  CalendarDays,
  ListFilter,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

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

interface CalendarEventItem {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  location?: string | null;
  isAllDay: boolean;
  taskId?: string | null;
  noteId?: string | null;
  task?: ConnectedTask | null;
  note?: ConnectedNote | null;
}

interface ReminderItem {
  id: string;
  title: string;
  description?: string | null;
  dueAt: string;
  isCompleted: boolean;
  escalationState: string;
  recurrence?: string | null;
  taskId?: string | null;
  noteId?: string | null;
  task?: ConnectedTask | null;
  note?: ConnectedNote | null;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [availableTasks, setAvailableTasks] = useState<ConnectedTask[]>([]);
  const [availableNotes, setAvailableNotes] = useState<ConnectedNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View Mode: Month Grid or Agenda
  const [viewMode, setViewMode] = useState<"MONTH" | "AGENDA">("MONTH");
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalItemType, setModalItemType] = useState<"EVENT" | "REMINDER">("EVENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemDate, setItemDate] = useState(new Date().toISOString().slice(0, 10));
  const [itemTime, setItemTime] = useState("09:00");
  const [itemEndTime, setItemEndTime] = useState("10:00");
  const [itemLocation, setItemLocation] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<{
    id: string;
    itemType: "EVENT" | "REMINDER";
  } | null>(null);

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    title: string;
    itemType: "EVENT" | "REMINDER";
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const monthYearString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  const fetchCalendarData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/calendar?month=${monthYearString}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
        setReminders(data.reminders || []);
        setAvailableTasks(data.availableTasks || []);
        setAvailableNotes(data.availableNotes || []);
      }
    } catch (e) {
      console.error("Failed to load calendar data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [monthYearString]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const startDateTime = `${itemDate}T${itemTime}:00`;
      const endDateTime = `${itemDate}T${itemEndTime}:00`;

      const method = editingItem ? "PATCH" : "POST";
      const body: any = {
        itemType: modalItemType,
        title: title.trim(),
        description: description.trim() || null,
        taskId: selectedTaskId || null,
        noteId: selectedNoteId || null,
      };

      if (editingItem) {
        body.id = editingItem.id;
        if (modalItemType === "EVENT") {
          body.startTime = startDateTime;
          body.endTime = endDateTime;
          body.location = itemLocation || null;
          body.isAllDay = isAllDay;
        } else {
          body.dueAt = `${itemDate}T${itemTime}:00`;
        }
      } else {
        if (modalItemType === "EVENT") {
          body.startTime = startDateTime;
          body.endTime = endDateTime;
          body.location = itemLocation || null;
          body.isAllDay = isAllDay;
        } else {
          body.date = `${itemDate}T${itemTime}:00`;
        }
      }

      const res = await fetch("/api/calendar", {
        method,
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
        fetchCalendarData();
      }
    } catch (e) {
      console.error("Failed to save calendar item:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (item: any, type: "EVENT" | "REMINDER") => {
    setEditingItem({ id: item.id, itemType: type });
    setModalItemType(type);
    setTitle(item.title);
    setDescription(item.description || "");
    setSelectedTaskId(item.taskId || "");
    setSelectedNoteId(item.noteId || "");

    if (type === "EVENT") {
      const d = new Date(item.startTime);
      setItemDate(d.toISOString().slice(0, 10));
      setItemTime(d.toTimeString().slice(0, 5));
      const endD = new Date(item.endTime);
      setItemEndTime(endD.toTimeString().slice(0, 5));
      setItemLocation(item.location || "");
      setIsAllDay(item.isAllDay || false);
    } else {
      const d = new Date(item.dueAt);
      setItemDate(d.toISOString().slice(0, 10));
      setItemTime(d.toTimeString().slice(0, 5));
    }
    setShowAddModal(true);
  };

  const handleToggleReminderDone = async (reminder: ReminderItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextCompleted = !reminder.isCompleted;

    setReminders((prev) =>
      prev.map((r) => (r.id === reminder.id ? { ...r, isCompleted: nextCompleted } : r))
    );

    try {
      await fetch("/api/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reminder.id,
          itemType: "REMINDER",
          isCompleted: nextCompleted,
        }),
      });
      fetchCalendarData();
    } catch (e) {
      console.error("Failed to toggle reminder:", e);
      fetchCalendarData();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/calendar?id=${deleteConfirm.id}&itemType=${deleteConfirm.itemType}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm(null);
        fetchCalendarData();
      }
    } catch (e) {
      console.error("Failed to delete item:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Build Month Calendar Days
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    // Adjust so Monday is 0
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNumber: number | null; dateString: string | null }> = [];

    // Leading blanks
    for (let i = 0; i < startOffset; i++) {
      days.push({ dayNumber: null, dateString: null });
    }

    // Days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ dayNumber: d, dateString: dateStr });
    }

    return days;
  };

  const days = getDaysInMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const todayStr = new Date().toISOString().slice(0, 10);

  // Group events and reminders for quick lookup
  const getItemsForDate = (dateStr: string) => {
    const dayEvents = events.filter((e) => e.startTime.startsWith(dateStr));
    const dayReminders = reminders.filter((r) => r.dueAt.startsWith(dateStr));
    return { events: dayEvents, reminders: dayReminders };
  };

  // Filtered Agenda Items
  const allAgendaItems = [
    ...events.map((e) => ({
      ...e,
      itemType: "EVENT" as const,
      timestamp: new Date(e.startTime).getTime(),
      dateString: e.startTime.slice(0, 10),
    })),
    ...reminders.map((r) => ({
      ...r,
      itemType: "REMINDER" as const,
      timestamp: new Date(r.dueAt).getTime(),
      dateString: r.dueAt.slice(0, 10),
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const filteredAgenda = selectedDayDate
    ? allAgendaItems.filter((i) => i.dateString === selectedDayDate)
    : allAgendaItems;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            Execution & Chrono Planning
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Scheduler & Calendar
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Schedule deadlines, meetings, and reminders connected to your tasks and notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => setViewMode("MONTH")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "MONTH" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode("AGENDA")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "AGENDA" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          <button
            onClick={() => {
              setEditingItem(null);
              setModalItemType("EVENT");
              setTitle("");
              setDescription("");
              setItemLocation("");
              setSelectedTaskId("");
              setSelectedNoteId("");
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Event / Reminder</span>
          </button>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-white">{monthName}</h2>
          {selectedDayDate && (
            <span className="text-xs text-blue-400 font-mono px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              Filter: {selectedDayDate}
              <button
                onClick={() => setSelectedDayDate(null)}
                className="ml-1.5 hover:text-white font-bold"
              >
                ×
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setCurrentDate(new Date());
              setSelectedDayDate(null);
            }}
            className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 font-medium"
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MONTH GRID VIEW */}
      {viewMode === "MONTH" && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60 text-center text-[11px] font-semibold text-slate-400 py-2.5 uppercase tracking-wider">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-800/50">
            {days.map((cell, idx) => {
              if (!cell.dayNumber || !cell.dateString) {
                return <div key={`empty-${idx}`} className="bg-slate-950/40 min-h-24 p-2" />;
              }

              const { events: dayEvs, reminders: dayRems } = getItemsForDate(cell.dateString);
              const isToday = cell.dateString === todayStr;
              const isSelected = cell.dateString === selectedDayDate;

              return (
                <div
                  key={cell.dateString}
                  onClick={() => {
                    setSelectedDayDate(cell.dateString === selectedDayDate ? null : cell.dateString);
                  }}
                  className={`bg-slate-900/90 hover:bg-slate-850 min-h-24 p-2 transition-colors cursor-pointer flex flex-col justify-between ${
                    isToday ? "ring-1 ring-blue-500/50 bg-blue-950/10" : ""
                  } ${isSelected ? "bg-slate-800/80 ring-2 ring-blue-500" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-semibold rounded-full h-5 w-5 flex items-center justify-center ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemDate(cell.dateString!);
                        setEditingItem(null);
                        setModalItemType("EVENT");
                        setShowAddModal(true);
                      }}
                      className="opacity-0 hover:opacity-100 p-0.5 text-slate-500 hover:text-white"
                      title="Add to this day"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Day items list */}
                  <div className="space-y-1 my-1 overflow-hidden">
                    {dayEvs.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(ev, "EVENT");
                        }}
                        className="truncate text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 hover:bg-blue-500/30"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {dayRems.slice(0, 2).map((rem) => (
                      <div
                        key={rem.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(rem, "REMINDER");
                        }}
                        className={`truncate text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border ${
                          rem.isCompleted
                            ? "bg-slate-800 text-slate-500 line-through border-slate-700"
                            : "bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span className="truncate">{rem.title}</span>
                      </div>
                    ))}
                    {dayEvs.length + dayRems.length > 4 && (
                      <span className="text-[9px] text-slate-500 font-mono block pl-1">
                        +{dayEvs.length + dayRems.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENDA / TIMELINE VIEW */}
      {(viewMode === "AGENDA" || selectedDayDate) && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>
                {selectedDayDate ? `Schedule for ${selectedDayDate}` : "Complete Agenda"} (
                {filteredAgenda.length})
              </span>
            </h2>
            {selectedDayDate && (
              <button
                onClick={() => setSelectedDayDate(null)}
                className="text-xs text-blue-400 hover:underline font-medium"
              >
                Show All Days
              </button>
            )}
          </div>

          {filteredAgenda.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No events or reminders scheduled for this period.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAgenda.map((item) => {
                const isEvent = item.itemType === "EVENT";
                const isRem = item.itemType === "REMINDER";

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      {isRem && (
                        <button
                          onClick={(e) => handleToggleReminderDone(item as any, e)}
                          className="mt-0.5 sm:mt-0 text-slate-500 hover:text-purple-400 transition-colors"
                        >
                          {(item as any).isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-purple-400" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-600" />
                          )}
                        </button>
                      )}

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                              isEvent
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : (item as any).isCompleted
                                ? "bg-slate-800 text-slate-500 border-slate-700"
                                : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            }`}
                          >
                            {isEvent ? "EVENT" : "REMINDER"}
                          </span>

                          <h3
                            className={`text-xs font-bold ${
                              isRem && (item as any).isCompleted
                                ? "line-through text-slate-500"
                                : "text-slate-100"
                            }`}
                          >
                            {item.title}
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3 text-slate-500" />
                            {isEvent
                              ? `${formatDate((item as any).startTime)}`
                              : `${formatDate((item as any).dueAt)}`}
                          </span>

                          {isEvent && (item as any).location && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <MapPin className="h-3 w-3 text-slate-500" />
                              {(item as any).location}
                            </span>
                          )}

                          {/* Connected Task Badge */}
                          {item.task && (
                            <Link
                              href="/tasks"
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 text-[10px] font-medium"
                            >
                              <CheckSquare className="h-3 w-3" />
                              <span className="truncate max-w-32">{item.task.title}</span>
                            </Link>
                          )}

                          {/* Connected Note Badge */}
                          {item.note && (
                            <Link
                              href="/notes"
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 text-[10px] font-medium"
                            >
                              <FileText className="h-3 w-3" />
                              <span className="truncate max-w-32">{item.note.title}</span>
                            </Link>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 font-sans">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => openEdit(item, item.itemType)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            id: item.id,
                            title: item.title,
                            itemType: item.itemType,
                          })
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-400" />
                {editingItem ? "Edit Schedule Item" : "Schedule Event or Reminder"}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              {/* Type Toggle */}
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
                  placeholder={
                    modalItemType === "EVENT"
                      ? "e.g. System Design Sync with Team"
                      : "e.g. Pay Internet Bill"
                  }
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
                  <label className="text-slate-300 block mb-1 font-medium">
                    {modalItemType === "EVENT" ? "Start Time" : "Due Time"}
                  </label>
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

              {/* CONNECT TO TASK */}
              <div>
                <label className="text-slate-300 block mb-1 font-medium flex items-center gap-1.5">
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

              {/* CONNECT TO NOTE */}
              <div>
                <label className="text-slate-300 block mb-1 font-medium flex items-center gap-1.5">
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
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
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
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteConfirm.title}&quot;</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
              >
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
