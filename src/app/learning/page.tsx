"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  Clock,
  BookOpen,
  Plus,
  CheckCircle2,
  Circle,
  Loader2,
  Trash2,
  Edit3,
  Eye,
  X,
  Calendar,
  FileText,
  AlertCircle,
  Check,
  ChevronRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface StudySessionItem {
  id: string;
  topicId: string;
  durationMinutes: number;
  notes?: string | null;
  studiedAt: string;
}

interface TopicItem {
  id: string;
  subjectId: string;
  title: string;
  description?: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | string;
  createdAt?: string;
  sessions?: StudySessionItem[];
}

interface SubjectItem {
  id: string;
  name: string;
  description?: string | null;
  progress: number;
  formattedStudyTime: string;
  totalMinutes: number;
  totalTopics: number;
  completedTopics: number;
  topics: TopicItem[];
}

export default function LearningPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Log Session Modal State
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [sessionNotes, setSessionNotes] = useState("");
  const [markCompleted, setMarkCompleted] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  // New Subject Modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [subjectDesc, setSubjectDesc] = useState("");
  const [topicsInput, setTopicsInput] = useState("");
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  // Edit Subject Modal
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectDesc, setEditSubjectDesc] = useState("");
  const [isUpdatingSubject, setIsUpdatingSubject] = useState(false);

  // Add Lesson Modal
  const [addLessonSubjectId, setAddLessonSubjectId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDesc, setLessonDesc] = useState("");
  const [lessonStatus, setLessonStatus] = useState<"NOT_STARTED" | "IN_PROGRESS" | "COMPLETED">("NOT_STARTED");
  const [isAddingLesson, setIsAddingLesson] = useState(false);

  // View Lesson / Detail Modal
  const [viewingTopic, setViewingTopic] = useState<{ topic: TopicItem; subject: SubjectItem } | null>(null);

  // Edit Lesson Modal
  const [editingTopic, setEditingTopic] = useState<{ topic: TopicItem; subject: SubjectItem } | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonDesc, setEditLessonDesc] = useState("");
  const [editLessonStatus, setEditLessonStatus] = useState<"NOT_STARTED" | "IN_PROGRESS" | "COMPLETED">("NOT_STARTED");
  const [editLessonSubjectId, setEditLessonSubjectId] = useState("");
  const [isUpdatingLesson, setIsUpdatingLesson] = useState(false);

  // Delete Confirmation Modals
  const [deleteTopicConfirm, setDeleteTopicConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleteSubjectConfirm, setDeleteSubjectConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSubjects = async () => {
    try {
      const res = await fetch("/api/learning");
      const data = await res.json();
      if (data.success) {
        setSubjects(data.subjects);
        // If a topic is currently being viewed, update its reference with latest data
        if (viewingTopic) {
          for (const s of data.subjects) {
            const found = s.topics.find((t: TopicItem) => t.id === viewingTopic.topic.id);
            if (found) {
              setViewingTopic({ topic: found, subject: s });
              break;
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to load learning data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Quick Toggle Status
  const handleToggleTopicStatus = async (topic: TopicItem, subject: SubjectItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const nextStatus = topic.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED";

    // Optimistic UI update
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subject.id) return s;
        const updatedTopics = s.topics.map((t) => (t.id === topic.id ? { ...t, status: nextStatus } : t));
        const completedCount = updatedTopics.filter((t) => t.status === "COMPLETED").length;
        const newProgress = updatedTopics.length > 0 ? Math.round((completedCount / updatedTopics.length) * 100) : 0;
        return {
          ...s,
          topics: updatedTopics,
          completedTopics: completedCount,
          progress: newProgress,
        };
      })
    );

    if (viewingTopic && viewingTopic.topic.id === topic.id) {
      setViewingTopic({
        ...viewingTopic,
        topic: { ...viewingTopic.topic, status: nextStatus },
      });
    }

    try {
      await fetch("/api/learning/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: topic.id, status: nextStatus }),
      });
      fetchSubjects();
    } catch (error) {
      console.error("Failed to toggle status:", error);
      fetchSubjects();
    }
  };

  // Add Lesson
  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addLessonSubjectId || !lessonTitle.trim() || isAddingLesson) return;

    setIsAddingLesson(true);
    try {
      const res = await fetch("/api/learning/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: addLessonSubjectId,
          title: lessonTitle.trim(),
          description: lessonDesc.trim() || undefined,
          status: lessonStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLessonTitle("");
        setLessonDesc("");
        setLessonStatus("NOT_STARTED");
        setAddLessonSubjectId(null);
        fetchSubjects();
      }
    } catch (error) {
      console.error("Failed to add lesson:", error);
    } finally {
      setIsAddingLesson(false);
    }
  };

  // Open Edit Lesson Modal
  const openEditLesson = (topic: TopicItem, subject: SubjectItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTopic({ topic, subject });
    setEditLessonTitle(topic.title);
    setEditLessonDesc(topic.description || "");
    setEditLessonStatus((topic.status as any) || "NOT_STARTED");
    setEditLessonSubjectId(subject.id);
  };

  // Submit Edit Lesson
  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic || !editLessonTitle.trim() || isUpdatingLesson) return;

    setIsUpdatingLesson(true);
    try {
      const res = await fetch("/api/learning/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTopic.topic.id,
          title: editLessonTitle.trim(),
          description: editLessonDesc.trim() || null,
          status: editLessonStatus,
          subjectId: editLessonSubjectId || editingTopic.subject.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingTopic(null);
        fetchSubjects();
      }
    } catch (error) {
      console.error("Failed to update lesson:", error);
    } finally {
      setIsUpdatingLesson(false);
    }
  };

  // Delete Lesson
  const handleDeleteLesson = async () => {
    if (!deleteTopicConfirm || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/learning/topics?id=${deleteTopicConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (viewingTopic?.topic.id === deleteTopicConfirm.id) {
          setViewingTopic(null);
        }
        setDeleteTopicConfirm(null);
        fetchSubjects();
      }
    } catch (error) {
      console.error("Failed to delete lesson:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Edit Subject Modal
  const openEditSubject = (subject: SubjectItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSubject(subject);
    setEditSubjectName(subject.name);
    setEditSubjectDesc(subject.description || "");
  };

  // Submit Edit Subject
  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editSubjectName.trim() || isUpdatingSubject) return;

    setIsUpdatingSubject(true);
    try {
      const res = await fetch("/api/learning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSubject.id,
          name: editSubjectName.trim(),
          description: editSubjectDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingSubject(null);
        fetchSubjects();
      }
    } catch (error) {
      console.error("Failed to update subject:", error);
    } finally {
      setIsUpdatingSubject(false);
    }
  };

  // Delete Subject
  const handleDeleteSubject = async () => {
    if (!deleteSubjectConfirm || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/learning?id=${deleteSubjectConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (viewingTopic?.subject.id === deleteSubjectConfirm.id) {
          setViewingTopic(null);
        }
        setDeleteSubjectConfirm(null);
        fetchSubjects();
      }
    } catch (error) {
      console.error("Failed to delete subject:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Log Session
  const handleLogSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId || !durationMinutes || isLogging) return;

    setIsLogging(true);
    try {
      const res = await fetch("/api/learning/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: selectedTopicId,
          durationMinutes: parseInt(durationMinutes, 10),
          notes: sessionNotes,
          markCompleted,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSessionModal(false);
        setSessionNotes("");
        setMarkCompleted(false);
        fetchSubjects();
      }
    } catch (e) {
      console.error("Failed to log session:", e);
    } finally {
      setIsLogging(false);
    }
  };

  // Create Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || isCreatingSubject) return;

    setIsCreatingSubject(true);
    const topicTitles = topicsInput
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subjectName.trim(),
          description: subjectDesc,
          topicTitles,
        }),
      });
      setSubjectName("");
      setSubjectDesc("");
      setTopicsInput("");
      setShowSubjectModal(false);
      fetchSubjects();
    } catch (e) {
      console.error("Failed to create subject:", e);
    } finally {
      setIsCreatingSubject(false);
    }
  };

  // Calculate total study time for a single topic
  const calculateTopicStudyTime = (topic: TopicItem) => {
    const mins = (topic.sessions || []).reduce((acc, s) => acc + s.durationMinutes, 0);
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    if (hours === 0) return `${remainder}m`;
    return `${hours}h ${remainder}m`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <GraduationCap className="h-3.5 w-3.5" />
            Education & Skill Acquisition
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Learning Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Structured skill trees connected to your knowledge base, projects, and work journal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedTopicId("");
              setShowSessionModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 cursor-pointer transition-all"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Log Study Session</span>
          </button>
          <button
            onClick={() => setShowSubjectModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Subject</span>
          </button>
        </div>
      </div>

      {/* Subjects Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Loading learning curriculum...</span>
        </div>
      ) : subjects.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 p-8 rounded-2xl bg-slate-900/40 border border-slate-800">
          No learning subjects added yet. Click &quot;New Subject&quot; to initialize your skill tree.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subj) => (
            <div
              key={subj.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 space-y-4 flex flex-col justify-between transition-all group/card"
            >
              <div className="space-y-3">
                {/* Subject Header with Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-100 truncate">{subj.name}</h3>
                    </div>
                    {subj.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {subj.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                      {subj.progress}%
                    </span>
                    <button
                      onClick={(e) => openEditSubject(subj, e)}
                      title="Edit Subject"
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteSubjectConfirm({ id: subj.id, name: subj.name });
                      }}
                      title="Delete Subject"
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${subj.progress}%` }}
                  />
                </div>

                {/* Topic/Lesson Checklist */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-1">
                    <span>Lessons ({subj.completedTopics}/{subj.totalTopics})</span>
                    <button
                      onClick={() => setAddLessonSubjectId(subj.id)}
                      className="flex items-center gap-1 text-purple-400 hover:text-purple-300 font-medium lowercase tracking-normal text-[11px] transition-colors cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>add lesson</span>
                    </button>
                  </div>

                  {subj.topics.length === 0 ? (
                    <div className="py-3 text-center text-[11px] text-slate-500 italic bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                      No lessons yet. Click &quot;add lesson&quot; above.
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      {subj.topics.map((t) => (
                        <div
                          key={t.id}
                          className="group/item flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-800/70 text-xs transition-colors cursor-pointer"
                          onClick={() => setViewingTopic({ topic: t, subject: subj })}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => handleToggleTopicStatus(t, subj, e)}
                              title={t.status === "COMPLETED" ? "Mark incomplete" : "Mark completed"}
                              className="shrink-0 text-slate-500 hover:text-purple-400 transition-colors cursor-pointer p-0.5"
                            >
                              {t.status === "COMPLETED" ? (
                                <CheckCircle2 className="h-4 w-4 text-purple-400" />
                              ) : (
                                <Circle className="h-4 w-4 text-slate-600 hover:text-slate-400" />
                              )}
                            </button>
                            <span
                              className={`truncate font-medium ${
                                t.status === "COMPLETED"
                                  ? "line-through text-slate-500"
                                  : "text-slate-200 group-hover/item:text-white"
                              }`}
                            >
                              {t.title}
                            </span>
                          </div>

                          {/* Quick Action Buttons on Hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingTopic({ topic: t, subject: subj });
                              }}
                              title="View Lesson Details"
                              className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-700/50"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => openEditLesson(t, subj, e)}
                              title="Edit Lesson"
                              className="p-1 rounded text-slate-400 hover:text-purple-400 hover:bg-slate-700/50"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTopicConfirm({ id: t.id, title: t.title });
                              }}
                              title="Delete Lesson"
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700/50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Study Time Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Clock className="h-3.5 w-3.5 text-purple-400" />
                  <span>Time Studied:</span>
                </span>
                <span className="font-mono text-slate-200 font-semibold text-[11px]">
                  {subj.formattedStudyTime}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW LESSON DETAILS MODAL */}
      {viewingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                    {viewingTopic.subject.name}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                      viewingTopic.topic.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : viewingTopic.topic.status === "IN_PROGRESS"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {viewingTopic.topic.status.replace("_", " ")}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white leading-snug">
                  {viewingTopic.topic.title}
                </h2>
              </div>
              <button
                onClick={() => setViewingTopic(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Lesson Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Lesson Overview
              </label>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                {viewingTopic.topic.description ? (
                  <p className="whitespace-pre-wrap">{viewingTopic.topic.description}</p>
                ) : (
                  <span className="italic text-slate-500">No description provided for this lesson yet.</span>
                )}
              </div>
            </div>

            {/* Study Stats & Quick Actions Bar */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
              <div className="flex items-center gap-2 text-xs">
                <Clock className="h-4 w-4 text-purple-400" />
                <div>
                  <div className="text-[10px] text-slate-400">Total Study Time</div>
                  <div className="font-mono font-bold text-slate-200">
                    {calculateTopicStudyTime(viewingTopic.topic)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <FileText className="h-4 w-4 text-purple-400" />
                <div>
                  <div className="text-[10px] text-slate-400">Recorded Sessions</div>
                  <div className="font-mono font-bold text-slate-200">
                    {viewingTopic.topic.sessions?.length || 0} sessions
                  </div>
                </div>
              </div>
            </div>

            {/* Study Session History */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Session History
                </label>
                <button
                  onClick={() => {
                    setSelectedTopicId(viewingTopic.topic.id);
                    setShowSessionModal(true);
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300"
                >
                  <Plus className="h-3 w-3" />
                  <span>Log Study Session</span>
                </button>
              </div>

              {!viewingTopic.topic.sessions || viewingTopic.topic.sessions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  No study sessions recorded for this lesson yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {viewingTopic.topic.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1.5 font-mono text-purple-300 font-semibold">
                          <Clock className="h-3 w-3" />
                          {s.durationMinutes} minutes
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(s.studiedAt)}
                        </span>
                      </div>
                      {s.notes && (
                        <p className="text-slate-300 text-[11px] whitespace-pre-wrap font-sans bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleTopicStatus(viewingTopic.topic, viewingTopic.subject)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-200 font-medium transition-colors cursor-pointer"
                >
                  {viewingTopic.topic.status === "COMPLETED" ? (
                    <>
                      <Circle className="h-3.5 w-3.5 text-slate-400" />
                      <span>Mark Incomplete</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Mark Completed</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => openEditLesson(viewingTopic.topic, viewingTopic.subject)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-200 font-medium transition-colors cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5 text-blue-400" />
                  <span>Edit Lesson</span>
                </button>
              </div>

              <button
                onClick={() =>
                  setDeleteTopicConfirm({
                    id: viewingTopic.topic.id,
                    title: viewingTopic.topic.title,
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-xs text-rose-400 font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Lesson</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LESSON MODAL */}
      {addLessonSubjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-purple-400" />
                Add New Lesson
              </h2>
              <button
                onClick={() => setAddLessonSubjectId(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddLesson} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Subject</label>
                <input
                  type="text"
                  disabled
                  value={subjects.find((s) => s.id === addLessonSubjectId)?.name || ""}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Lesson / Topic Title</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Consensus & Raft Algorithm"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Description / Learning Goals</label>
                <textarea
                  rows={3}
                  placeholder="What will you learn or understand in this lesson?"
                  value={lessonDesc}
                  onChange={(e) => setLessonDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Status</label>
                <select
                  value={lessonStatus}
                  onChange={(e) => setLessonStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddLessonSubjectId(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!lessonTitle.trim() || isAddingLesson}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isAddingLesson ? "Adding..." : "Add Lesson"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LESSON MODAL */}
      {editingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-purple-400" />
                Edit Lesson
              </h2>
              <button
                onClick={() => setEditingTopic(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateLesson} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Subject</label>
                <select
                  value={editLessonSubjectId}
                  onChange={(e) => setEditLessonSubjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Lesson Title</label>
                <input
                  type="text"
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Description</label>
                <textarea
                  rows={3}
                  value={editLessonDesc}
                  onChange={(e) => setEditLessonDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Status</label>
                <select
                  value={editLessonStatus}
                  onChange={(e) => setEditLessonStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTopic(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editLessonTitle.trim() || isUpdatingLesson}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingLesson ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUBJECT MODAL */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-400" />
                Edit Subject
              </h2>
              <button
                onClick={() => setEditingSubject(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubject} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Subject Name</label>
                <input
                  type="text"
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Description</label>
                <textarea
                  rows={3}
                  value={editSubjectDesc}
                  onChange={(e) => setEditSubjectDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editSubjectName.trim() || isUpdatingSubject}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingSubject ? "Saving..." : "Save Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE LESSON CONFIRMATION MODAL */}
      {deleteTopicConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-white">Delete Lesson?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteTopicConfirm.title}&quot;</strong>? All associated study logs will also be removed.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTopicConfirm(null)}
                className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteLesson}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete Lesson"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SUBJECT CONFIRMATION MODAL */}
      {deleteSubjectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-white">Delete Subject?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteSubjectConfirm.name}&quot;</strong>? This will permanently delete this subject and all its lessons and study sessions.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteSubjectConfirm(null)}
                className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubject}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete Subject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG STUDY SESSION MODAL */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-400" />
                Log Study Session
              </h2>
              <button
                onClick={() => setShowSessionModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLogSession} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Topic / Lesson</label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                >
                  <option value="">Select a topic to study...</option>
                  {subjects.map((s) => (
                    <optgroup key={s.id} label={s.name}>
                      {s.topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.status.replace("_", " ")})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="25">25 minutes (Pomodoro)</option>
                  <option value="45">45 minutes (Deep Study)</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">
                  Study Notes (Saved automatically into your Knowledge Base)
                </label>
                <textarea
                  rows={4}
                  placeholder="Key concepts learned, code observations, or formulas..."
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="markCompletedCheck"
                  checked={markCompleted}
                  onChange={(e) => setMarkCompleted(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-0"
                />
                <label htmlFor="markCompletedCheck" className="text-slate-300 cursor-pointer">
                  Mark this lesson as fully completed
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedTopicId || isLogging}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isLogging ? "Logging..." : "Record Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW SUBJECT MODAL */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-400" />
                Create New Subject
              </h2>
              <button
                onClick={() => setShowSubjectModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Subject Name</label>
                <input
                  type="text"
                  placeholder="e.g. System Design, DevOps, Rust"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="Focus area & objectives"
                  value={subjectDesc}
                  onChange={(e) => setSubjectDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Lessons / Topics (One per line)</label>
                <textarea
                  rows={4}
                  placeholder="Event Driven Systems&#10;Consistent Hashing&#10;Database Sharding"
                  value={topicsInput}
                  onChange={(e) => setTopicsInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!subjectName.trim() || isCreatingSubject}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingSubject ? "Creating..." : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
