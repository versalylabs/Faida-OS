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
  Sparkles,
  Database,
  Layers,
  Cpu,
} from "lucide-react";

interface TopicItem {
  id: string;
  title: string;
  status: string;
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

  const fetchSubjects = async () => {
    try {
      const res = await fetch("/api/learning");
      const data = await res.json();
      if (data.success) {
        setSubjects(data.subjects);
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

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

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
    }
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
            onClick={() => setShowSessionModal(true)}
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
              className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 space-y-4 flex flex-col justify-between transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{subj.name}</h3>
                    {subj.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                        {subj.description}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold shrink-0">
                    {subj.progress}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${subj.progress}%` }}
                  />
                </div>

                {/* Topic Checklist */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Topics ({subj.completedTopics}/{subj.totalTopics})
                  </div>
                  {subj.topics.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-slate-300">
                      {t.status === "COMPLETED" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          t.status === "COMPLETED" ? "line-through text-slate-500" : ""
                        }`}
                      >
                        {t.title}
                      </span>
                    </div>
                  ))}
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

      {/* Log Study Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-400" />
              Log Study Session
            </h2>
            <form onSubmit={handleLogSession} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Topic</label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  required
                >
                  <option value="">Select a topic to study...</option>
                  {subjects.map((s) => (
                    <optgroup key={s.id} label={s.name}>
                      {s.topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.status})
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none font-mono text-[11px]"
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
                  Mark this topic as fully completed
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

      {/* New Subject Modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-bold text-white">Create New Subject</h2>
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
                <label className="text-slate-300 block mb-1 font-medium">Topics (One per line)</label>
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
                  disabled={!subjectName.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
