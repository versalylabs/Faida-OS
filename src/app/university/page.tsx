"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  Calendar,
  Clock,
  CheckSquare,
  Sparkles,
  AlertTriangle,
  BookOpen,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  FileText,
  MapPin,
  UploadCloud,
  Zap,
  Layers,
  ArrowRight,
  X,
  Loader2,
  ListTodo,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface Course {
  id: string;
  code: string;
  name: string;
  lecturer?: string | null;
  semester: string;
  color: string;
  credits: number;
  _count?: {
    assignments: number;
    assessments: number;
    classes: number;
    materials: number;
  };
}

interface ClassSession {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  building?: string | null;
  lecturer?: string | null;
  isOnline: boolean;
  meetingUrl?: string | null;
  course: {
    id: string;
    code: string;
    name: string;
    color: string;
  };
}

interface Subtask {
  id: string;
  title: string;
  isDone: boolean;
}

interface AssignmentItem {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "DONE";
  estimatedMinutes?: number | null;
  submissionUrl?: string | null;
  course?: {
    id: string;
    code: string;
    name: string;
    color: string;
  } | null;
  subtasks: Subtask[];
  daysRemaining?: number | null;
  hoursRemaining?: number | null;
  progressPercent?: number;
}

interface AssessmentItem {
  id: string;
  courseId: string;
  title: string;
  type: "CAT_1" | "CAT_2" | "EXAM" | "QUIZ" | "PRACTICAL";
  date: string;
  weightPercent?: number | null;
  topicsCovered?: string | null;
  isCompleted: boolean;
  score?: number | null;
  maxScore?: number | null;
  estimatedEffortHours: number;
  course: {
    id: string;
    code: string;
    name: string;
    color: string;
  };
  daysRemaining?: number;
}

interface LowEnergyTask {
  id: string;
  title: string;
  durationMinutes?: number | null;
  courseCode: string;
  type: "TASK" | "PREP" | "BATCH";
}

interface WorkloadStats {
  totalWeeklyClassHours: number;
  totalAssignmentHours: number;
  totalCATPrepHours: number;
  totalEstimatedWorkHours: number;
  workloadPercentage: number;
  hasWorkloadSpike: boolean;
  upcomingDeadlinesIn4DaysCount: number;
}

interface ClassBriefing {
  courseCode: string;
  courseName: string;
  lecturer: string;
  lastTopic: string;
  relevantMaterial?: string | null;
  currentCoursework: string;
  upcomingAssessment: string;
  suggestedPreparation: string;
  recentNotesCount: number;
  materialsCount: number;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function UniversityPage() {
  const [activeTab, setActiveTab] = useState<"orbit" | "assignments" | "classes" | "assessments" | "courses">("orbit");
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [courses, setCourses] = useState<Course[]>([]);
  const [todayClasses, setTodayClasses] = useState<ClassSession[]>([]);
  const [nextClass, setNextClass] = useState<ClassSession | null>(null);
  const [nextClassMinutes, setNextClassMinutes] = useState<number | null>(null);
  const [dueSoonAssignments, setDueSoonAssignments] = useState<AssignmentItem[]>([]);
  const [allAssignments, setAllAssignments] = useState<AssignmentItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [allClasses, setAllClasses] = useState<ClassSession[]>([]);
  const [workload, setWorkload] = useState<WorkloadStats>({
    totalWeeklyClassHours: 0,
    totalAssignmentHours: 0,
    totalCATPrepHours: 0,
    totalEstimatedWorkHours: 0,
    workloadPercentage: 0,
    hasWorkloadSpike: false,
    upcomingDeadlinesIn4DaysCount: 0,
  });
  const [lowEnergyBatch, setLowEnergyBatch] = useState<LowEnergyTask[]>([]);
  const [batchCompleted, setBatchCompleted] = useState(false);

  // Modals
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingData, setBriefingData] = useState<ClassBriefing | null>(null);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedCourseForDetail, setSelectedCourseForDetail] = useState<Course | null>(null);

  // Form states
  const [newCourse, setNewCourse] = useState({ code: "", name: "", lecturer: "", semester: "Year 2 Sem 1", color: "#3b82f6", credits: 3 });
  const [newAssign, setNewAssign] = useState({ courseId: "", title: "", dueDate: "", estimatedMinutes: 120, priority: "MEDIUM", submissionUrl: "" });
  const [newAssessment, setNewAssessment] = useState({ courseId: "", title: "CAT 1", type: "CAT_1", date: "", weightPercent: 20, topicsCovered: "", estimatedEffortHours: 4 });
  const [newClass, setNewClass] = useState({ courseId: "", dayOfWeek: 1, startTime: "08:00", endTime: "11:00", room: "", lecturer: "", isOnline: false, meetingUrl: "" });

  // Sync state
  const [syncMode, setSyncMode] = useState<"MANUAL_IMPORT" | "ICAL_SYNC" | "MOODLE_REST">("MANUAL_IMPORT");
  const [iCalUrl, setICalUrl] = useState("");
  const [moodleUrl, setMoodleUrl] = useState("");
  const [moodleToken, setMoodleToken] = useState("");
  const [jsonImportText, setJsonImportText] = useState("");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch all dashboard & university data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [dashRes, assignRes, classRes] = await Promise.all([
        fetch("/api/university/dashboard", { cache: "no-store" }),
        fetch("/api/university/assignments", { cache: "no-store" }),
        fetch("/api/university/classes", { cache: "no-store" }),
      ]);

      const dashData = await dashRes.json();
      const assignData = await assignRes.json();
      const classData = await classRes.json();

      if (dashData.success) {
        setCourses(dashData.courses || []);
        setTodayClasses(dashData.todayClasses || []);
        setNextClass(dashData.nextClass || null);
        setNextClassMinutes(dashData.nextClassMinutesRemaining);
        setDueSoonAssignments(dashData.dueSoonAssignments || []);
        setAssessments(dashData.upcomingAssessments || []);
        setWorkload(dashData.workload || {
          totalWeeklyClassHours: 0,
          totalAssignmentHours: 0,
          totalCATPrepHours: 0,
          totalEstimatedWorkHours: 0,
          workloadPercentage: 0,
          hasWorkloadSpike: false,
          upcomingDeadlinesIn4DaysCount: 0,
        });
        setLowEnergyBatch(dashData.lowEnergyBatch || []);
      }

      if (assignData.success) {
        setAllAssignments(assignData.assignments || []);
      }

      if (classData.success) {
        setAllClasses(classData.classes || []);
      }
    } catch (err) {
      console.error("Failed to load academic dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Trigger "Prepare Me" Briefing
  const handlePrepareMe = async (courseId?: string, classId?: string) => {
    try {
      setShowPrepareModal(true);
      setBriefingLoading(true);
      setBriefingData(null);

      let url = "/api/university/prepare";
      if (courseId) url += `?courseId=${courseId}`;
      else if (classId) url += `?classId=${classId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.briefing) {
        setBriefingData(data.briefing);
      }
    } catch (e) {
      console.error("Failed to load class preparation briefing:", e);
    } finally {
      setBriefingLoading(false);
    }
  };

  // Trigger AI Assignment Decomposition
  const handleDecomposeAssignment = async (assign: AssignmentItem) => {
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `break down assignment ${assign.title}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh assignments to show newly created subtasks
        fetchData();
      }
    } catch (e) {
      console.error("Failed to decompose assignment:", e);
    }
  };

  // Complete a task / assignment
  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
    } catch (e) {
      console.error("Failed to toggle task status:", e);
    }
  };

  // Generate Study Plan for a CAT/Exam
  const handleGenerateStudyPlan = async (assessment: AssessmentItem) => {
    try {
      // Create 3 structured study sprint tasks scheduled before the assessment date
      const assessDate = new Date(assessment.date);
      const dayBefore = new Date(assessDate.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysBefore = new Date(assessDate.getTime() - 3 * 24 * 60 * 60 * 1000);

      const studySessions = [
        {
          title: `Study Sprint 1: Review ${assessment.course.code} lecture notes & slides (${assessment.title})`,
          estimatedMinutes: 60,
          dueDate: threeDaysBefore.toISOString(),
          priority: "HIGH",
        },
        {
          title: `Study Sprint 2: Solve past CAT questions & practice problems (${assessment.course.code})`,
          estimatedMinutes: 90,
          dueDate: dayBefore.toISOString(),
          priority: "URGENT",
        },
        {
          title: `Study Sprint 3: 30-min final recall & formula/concept check (${assessment.course.code})`,
          estimatedMinutes: 30,
          dueDate: assessDate.toISOString(),
          priority: "HIGH",
        },
      ];

      for (const s of studySessions) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: s.title,
            estimatedMinutes: s.estimatedMinutes,
            dueDate: s.dueDate,
            priority: s.priority,
            courseId: assessment.courseId,
            isAcademic: true,
          }),
        });
      }

      alert(`Generated 3 study sessions in Daily Planner for ${assessment.title} (${assessment.course.code})!`);
      fetchData();
    } catch (e) {
      console.error("Failed to generate study plan:", e);
    }
  };

  // Execute Low-Energy University Batch
  const handleExecuteBatch = async () => {
    setBatchCompleted(true);
    try {
      // Mark or schedule tasks in the batch
      for (const item of lowEnergyBatch) {
        if (item.type === "TASK") {
          await fetch(`/api/tasks/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "DONE" }),
          });
        }
      }
      setTimeout(() => {
        fetchData();
        setBatchCompleted(false);
      }, 1200);
    } catch (e) {
      console.error("Failed to execute batch:", e);
    }
  };

  // Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/university/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCourse),
      });
      if (res.ok) {
        setShowCourseModal(false);
        setNewCourse({ code: "", name: "", lecturer: "", semester: "Year 2 Sem 1", color: "#3b82f6", credits: 3 });
        fetchData();
      }
    } catch (e) {
      console.error("Failed to create course:", e);
    }
  };

  // Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/university/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAssign,
          estimatedMinutes: Number(newAssign.estimatedMinutes),
        }),
      });
      if (res.ok) {
        setShowAssignmentModal(false);
        setNewAssign({ courseId: "", title: "", dueDate: "", estimatedMinutes: 120, priority: "MEDIUM", submissionUrl: "" });
        fetchData();
      }
    } catch (e) {
      console.error("Failed to create assignment:", e);
    }
  };

  // Create Assessment
  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/university/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAssessment,
          weightPercent: Number(newAssessment.weightPercent),
          estimatedEffortHours: Number(newAssessment.estimatedEffortHours),
        }),
      });
      if (res.ok) {
        setShowAssessmentModal(false);
        setNewAssessment({ courseId: "", title: "CAT 1", type: "CAT_1", date: "", weightPercent: 20, topicsCovered: "", estimatedEffortHours: 4 });
        fetchData();
      }
    } catch (e) {
      console.error("Failed to create assessment:", e);
    }
  };

  // Create Class Session
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/university/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newClass,
          dayOfWeek: Number(newClass.dayOfWeek),
        }),
      });
      if (res.ok) {
        setShowClassModal(false);
        setNewClass({ courseId: "", dayOfWeek: 1, startTime: "08:00", endTime: "11:00", room: "", lecturer: "", isOnline: false, meetingUrl: "" });
        fetchData();
      }
    } catch (e) {
      console.error("Failed to create class:", e);
    }
  };

  // Sync / Import Trigger
  const handleRunSync = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus("Connecting to academic data feed...");

      let payload: any = { mode: syncMode };

      if (syncMode === "ICAL_SYNC") {
        payload.iCalUrl = iCalUrl;
      } else if (syncMode === "MOODLE_REST") {
        payload.moodleUrl = moodleUrl;
        payload.moodleToken = moodleToken;
      } else if (syncMode === "MANUAL_IMPORT") {
        try {
          payload.importData = JSON.parse(jsonImportText);
        } catch {
          setSyncStatus("Invalid JSON format. Please verify the structure.");
          setIsSyncing(false);
          return;
        }
      }

      const res = await fetch("/api/university/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSyncStatus(`Sync Successful! Imported: ${data.importedCount}, Updated: ${data.updatedCount}`);
        setTimeout(() => {
          setShowSyncModal(false);
          setSyncStatus(null);
          fetchData();
        }, 1200);
      } else {
        setSyncStatus(`Sync Failed: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      setSyncStatus(`Error: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Quick Preset Sample for BSc Applied Computing
  const loadAppliedComputingSample = () => {
    const sample = {
      courses: [
        { code: "BAC 2101", name: "Object-Oriented Programming (Java)", lecturer: "Dr. Njoroge", semester: "Year 2 Sem 1", color: "#3b82f6", credits: 3 },
        { code: "BAC 2102", name: "Data Structures & Algorithms", lecturer: "Prof. Omondi", semester: "Year 2 Sem 1", color: "#8b5cf6", credits: 4 },
        { code: "BAC 2103", name: "Database Systems & Design", lecturer: "Dr. Wanjiku", semester: "Year 2 Sem 1", color: "#10b981", credits: 3 },
        { code: "BAC 2104", name: "Computer Networks & Protocols", lecturer: "Eng. Kiprotich", semester: "Year 2 Sem 1", color: "#f59e0b", credits: 3 },
        { code: "BAC 2105", name: "Discrete Mathematics for Computing", lecturer: "Dr. Mutua", semester: "Year 2 Sem 1", color: "#ec4899", credits: 3 },
      ],
      assignments: [
        { title: "Lab 3: Binary Search Tree Implementation", courseCode: "BAC 2102", dueDate: new Date(Date.now() + 3 * 86400000).toISOString(), estimatedMinutes: 120, priority: "HIGH" },
        { title: "Relational Schema Normalization Project (3NF)", courseCode: "BAC 2103", dueDate: new Date(Date.now() + 5 * 86400000).toISOString(), estimatedMinutes: 180, priority: "URGENT" },
        { title: "Packet Sniffing & Wireshark Protocol Analysis", courseCode: "BAC 2104", dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), estimatedMinutes: 90, priority: "MEDIUM" },
      ],
      classes: [
        { courseCode: "BAC 2101", dayOfWeek: 1, startTime: "08:00", endTime: "11:00", room: "Lab C-04", lecturer: "Dr. Njoroge" },
        { courseCode: "BAC 2102", dayOfWeek: 2, startTime: "11:00", endTime: "14:00", room: "Lecture Theatre 2", lecturer: "Prof. Omondi" },
        { courseCode: "BAC 2103", dayOfWeek: 3, startTime: "09:00", endTime: "12:00", room: "Lab A-12", lecturer: "Dr. Wanjiku" },
        { courseCode: "BAC 2104", dayOfWeek: 4, startTime: "14:00", endTime: "17:00", room: "Room 302", lecturer: "Eng. Kiprotich" },
      ],
    };
    setJsonImportText(JSON.stringify(sample, null, 2));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-100">Academic Command Center</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  BSc Applied Computing
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Unified intelligence layer • Synchronized with Moodle LMS & Timetable
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSyncModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            Sync Moodle / Import
          </button>
          <button
            onClick={() => setShowCourseModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
          >
            <Plus className="h-3.5 w-3.5 text-slate-400" />
            Course
          </button>
          <button
            onClick={() => setShowClassModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Class
          </button>
          <button
            onClick={() => setShowAssignmentModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
          >
            <CheckSquare className="h-3.5 w-3.5 text-slate-400" />
            Assignment
          </button>
          <button
            onClick={() => setShowAssessmentModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm"
          >
            <Zap className="h-3.5 w-3.5" />
            CAT / Exam
          </button>
        </div>
      </div>

      {/* 2. Top Command Bar: Academic Load & Next Class Pill */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Next Class Countdown Pill */}
        <div className="md:col-span-2 rounded-xl bg-slate-900 border border-slate-800 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Next Upcoming Class</span>
              </div>
              {nextClass ? (
                <div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: nextClass.course.color }}>
                      {nextClass.course.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-100">{nextClass.course.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      {nextClass.startTime} - {nextClass.endTime}
                      {nextClassMinutes !== null && ` (in ${nextClassMinutes} mins)`}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      {nextClass.isOnline ? "Online Virtual Lecture" : nextClass.room || "Campus Hall"}
                    </span>
                    {nextClass.lecturer && <span>• {nextClass.lecturer}</span>}
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  <p className="text-sm text-slate-300 font-medium">No more classes scheduled today.</p>
                  <p className="text-xs text-slate-500">Great job! Use the extra open focus time for coursework or recovery.</p>
                </div>
              )}
            </div>

            {/* Prepare Me Action Button */}
            {nextClass ? (
              <button
                onClick={() => handlePrepareMe(nextClass.courseId, nextClass.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95 shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-200" />
                Prepare Me
              </button>
            ) : courses.length > 0 ? (
              <button
                onClick={() => handlePrepareMe(courses[0].id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                Briefing
              </button>
            ) : null}
          </div>
        </div>

        {/* Workload Indicator Card */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weekly Academic Load</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                workload.workloadPercentage > 85
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : workload.workloadPercentage > 60
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}
            >
              {workload.workloadPercentage}% Capacity
            </span>
          </div>

          <div className="my-2">
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  workload.workloadPercentage > 85
                    ? "bg-red-500"
                    : workload.workloadPercentage > 60
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${Math.min(100, workload.workloadPercentage)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{workload.totalEstimatedWorkHours}h scheduled</span>
            <span>Classes: {workload.totalWeeklyClassHours}h • Tasks: {workload.totalAssignmentHours}h</span>
          </div>
        </div>
      </div>

      {/* Workload Spike Alert (If Active) */}
      {workload.hasWorkloadSpike && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Academic Workload Spike Alert:</span> {workload.upcomingDeadlinesIn4DaysCount} major assignments or CATs due within the next 4 days.
            </div>
          </div>
          <span className="text-amber-400 font-semibold px-2 py-0.5 bg-amber-500/20 rounded">Effort Optimized</span>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        {[
          { id: "orbit", label: "Today & Orbit", icon: CompassIcon },
          { id: "assignments", label: `Assignments (${dueSoonAssignments.length})`, icon: CheckSquare },
          { id: "classes", label: `Weekly Timetable (${allClasses.length})`, icon: Calendar },
          { id: "assessments", label: `CATs & Exams (${assessments.length})`, icon: Zap },
          { id: "courses", label: `Courses (${courses.length})`, icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? "border-blue-500 text-blue-400 bg-blue-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. Tab Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span className="text-xs">Loading academic telemetry...</span>
        </div>
      ) : activeTab === "orbit" ? (
        /* ORBIT TAB: Today's Classes, Due Soon, and Low-Energy Batch */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Today's Classes & Academic Tasks */}
            <div className="lg:col-span-2 space-y-6">
              {/* Today's Classes */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Today&apos;s Class Schedule ({DAYS_OF_WEEK[new Date().getDay()]})
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">{todayClasses.length} session{todayClasses.length === 1 ? "" : "s"}</span>
                </div>

                {todayClasses.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-800 rounded-lg">
                    <Calendar className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No classes scheduled for today.</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Use this day for deep work sprints or study sessions.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayClasses.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-1.5 h-10 rounded-full"
                            style={{ backgroundColor: c.course.color }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-200">{c.course.code}</span>
                              <span className="text-xs text-slate-400">• {c.course.name}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1 font-medium text-slate-300">
                                <Clock className="h-3 w-3 text-slate-500" />
                                {c.startTime} - {c.endTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-500" />
                                {c.isOnline ? "Virtual / Teams" : c.room || "Main Campus"}
                              </span>
                              {c.lecturer && <span>• {c.lecturer}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {c.meetingUrl && (
                            <a
                              href={c.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-all"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handlePrepareMe(c.courseId, c.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-medium transition-all"
                          >
                            <Sparkles className="h-3 w-3" />
                            Prepare Me
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Due Soon Assignments */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Upcoming Assignments & Coursework
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveTab("assignments")}
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                  >
                    View all ({dueSoonAssignments.length})
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {dueSoonAssignments.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-800 rounded-lg">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">All caught up! No assignments due soon.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dueSoonAssignments.slice(0, 4).map((a) => (
                      <div
                        key={a.id}
                        className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => handleToggleTask(a.id, a.status)}
                              className="mt-0.5 text-slate-500 hover:text-emerald-400 transition-colors"
                            >
                              {a.status === "DONE" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Circle className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                {a.course && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                                    style={{ backgroundColor: a.course.color }}
                                  >
                                    {a.course.code}
                                  </span>
                                )}
                                <span className="text-xs font-semibold text-slate-200">{a.title}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                                {a.dueDate && (
                                  <span
                                    className={`font-medium ${
                                      typeof a.daysRemaining === "number" && a.daysRemaining <= 2
                                        ? "text-red-400"
                                        : "text-amber-400"
                                    }`}
                                  >
                                    Due: {formatDate(a.dueDate)} ({typeof a.daysRemaining === "number" ? `${a.daysRemaining}d left` : "upcoming"})
                                  </span>
                                )}
                                {a.estimatedMinutes && <span>⏱ ~{a.estimatedMinutes}m effort</span>}
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                    a.priority === "URGENT"
                                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                      : a.priority === "HIGH"
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                      : "bg-slate-800 text-slate-400"
                                  }`}
                                >
                                  {a.priority}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {a.subtasks.length === 0 && (
                              <button
                                onClick={() => handleDecomposeAssignment(a)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-all"
                                title="Break down into 5 conservative steps"
                              >
                                <Sparkles className="h-3 w-3 text-blue-400" />
                                Break Down
                              </button>
                            )}
                            {a.submissionUrl && (
                              <a
                                href={a.submissionUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                                title="Open Submission Link"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Subtask Progress Bar if available */}
                        {a.subtasks.length > 0 && (
                          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                            <div className="flex items-center gap-2 w-full max-w-xs">
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${a.progressPercent || 0}%` }}
                                />
                              </div>
                              <span className="text-[10px] shrink-0 font-medium">
                                {a.subtasks.filter((s) => s.isDone).length}/{a.subtasks.length} steps
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Low-Energy Batch & Upcoming CATs */}
            <div className="space-y-6">
              {/* Low-Energy University Batch */}
              <div className="rounded-xl bg-gradient-to-b from-blue-950/20 to-slate-900 border border-blue-500/20 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Low-Energy Batch
                    </h2>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Micro Wins
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Low on focus? Knock out these lightweight 5–15 minute academic wins without heavy mental strain.
                </p>

                <div className="space-y-2">
                  {lowEnergyBatch.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-blue-400 px-1.5 py-0.5 rounded bg-blue-500/10">
                          {item.courseCode}
                        </span>
                        <span className="text-slate-200 text-[11px] font-medium truncate max-w-[170px]">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {item.durationMinutes}m
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleExecuteBatch}
                  disabled={batchCompleted || lowEnergyBatch.length === 0}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    batchCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95"
                  }`}
                >
                  {batchCompleted ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Batch Executed!
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      DO THE WHOLE BATCH (~30m)
                    </>
                  )}
                </button>
              </div>

              {/* Upcoming CATs & Exams */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      CATs & Exams
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveTab("assessments")}
                    className="text-xs text-purple-400 hover:underline flex items-center gap-1"
                  >
                    All ({assessments.length})
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {assessments.length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-slate-800 rounded-lg">
                    <p className="text-xs text-slate-400">No upcoming CATs or exams.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assessments.slice(0, 3).map((ass) => (
                      <div
                        key={ass.id}
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                            style={{ backgroundColor: ass.course.color }}
                          >
                            {ass.course.code}
                          </span>
                          <span className="text-[11px] font-bold text-purple-400 font-mono">
                            {ass.daysRemaining} days left
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">{ass.title}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatDate(ass.date)} • {ass.weightPercent || 20}% of final grade
                          </p>
                        </div>
                        <button
                          onClick={() => handleGenerateStudyPlan(ass)}
                          className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Sparkles className="h-3 w-3 text-purple-400" />
                          Generate Study Plan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "assignments" ? (
        /* ASSIGNMENTS TAB */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100">All Academic Assignments & Coursework</h2>
            <button
              onClick={() => setShowAssignmentModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              New Assignment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAssignments.map((a) => (
              <div
                key={a.id}
                className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    {a.course ? (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: a.course.color }}
                      >
                        {a.course.code}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">Academic</span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        a.status === "DONE"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : a.priority === "URGENT"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {a.status === "DONE" ? "Completed" : a.priority}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mt-2">{a.title}</h3>
                  {a.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      {a.dueDate ? formatDate(a.dueDate) : "No deadline"}
                    </span>
                    <span>~{a.estimatedMinutes || 60}m</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleTask(a.id, a.status)}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-emerald-400 transition-colors"
                  >
                    {a.status === "DONE" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-500" />
                    )}
                    <span>{a.status === "DONE" ? "Done" : "Mark Done"}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {a.subtasks.length === 0 && (
                      <button
                        onClick={() => handleDecomposeAssignment(a)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs flex items-center gap-1"
                        title="Decompose into steps"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {a.submissionUrl && (
                      <a
                        href={a.submissionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === "classes" ? (
        /* CLASSES / TIMETABLE TAB */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100">Weekly Academic Timetable</h2>
            <button
              onClick={() => setShowClassModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Class Session
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((dayNum) => {
              const dayClasses = allClasses.filter((c) => c.dayOfWeek === dayNum);
              return (
                <div key={dayNum} className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-200">{DAYS_OF_WEEK[dayNum]}</span>
                    <span className="text-[10px] text-slate-500">{dayClasses.length} classes</span>
                  </div>

                  {dayClasses.length === 0 ? (
                    <p className="text-xs text-slate-600 italic py-4 text-center">No classes</p>
                  ) : (
                    <div className="space-y-2.5">
                      {dayClasses.map((cls) => (
                        <div
                          key={cls.id}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                              style={{ backgroundColor: cls.course.color }}
                            >
                              {cls.course.code}
                            </span>
                            <button
                              onClick={() => handlePrepareMe(cls.courseId, cls.id)}
                              className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5"
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              Prep
                            </button>
                          </div>
                          <div className="font-semibold text-slate-200 text-[11px] truncate">
                            {cls.course.name}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="h-2.5 w-2.5 text-slate-500" />
                            {cls.startTime} - {cls.endTime}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5 text-slate-500" />
                            {cls.isOnline ? "Virtual / Online" : cls.room || "Room TBD"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === "assessments" ? (
        /* ASSESSMENTS / CATS TAB */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100">Continuous Assessment Tests (CATs) & Final Exams</h2>
            <button
              onClick={() => setShowAssessmentModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              New CAT / Exam
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessments.map((ass) => (
              <div
                key={ass.id}
                className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold text-white"
                      style={{ backgroundColor: ass.course.color }}
                    >
                      {ass.course.code}
                    </span>
                    <span className="text-xs font-bold text-purple-400 font-mono">
                      {ass.daysRemaining} days left
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mt-2">{ass.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Date: <span className="font-semibold text-slate-300">{formatDate(ass.date)}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Weight: <span className="font-semibold text-slate-300">{ass.weightPercent || 20}%</span> • Est. Study Effort:{" "}
                    <span className="font-semibold text-slate-300">{ass.estimatedEffortHours} hours</span>
                  </p>

                  {ass.topicsCovered && (
                    <div className="mt-2.5 p-2 bg-slate-950 rounded border border-slate-800/80 text-[11px] text-slate-300">
                      <span className="font-semibold text-slate-400">Topics:</span> {ass.topicsCovered}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleGenerateStudyPlan(ass)}
                    className="w-full py-2 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-500/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-Generate 3 Study Sessions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* COURSES TAB */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100">Enrolled Degree Courses ({courses.length})</h2>
            <button
              onClick={() => setShowCourseModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              New Course
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4 flex flex-col justify-between hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold text-white"
                      style={{ backgroundColor: course.color }}
                    >
                      {course.code}
                    </span>
                    <span className="text-xs text-slate-400">{course.semester}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mt-2">{course.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">Lecturer: {course.lecturer || "Instructor TBD"}</p>

                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-xs font-bold text-slate-200">
                        {course._count?.assignments || 0}
                      </div>
                      <div className="text-[10px] text-slate-500">Tasks</div>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-xs font-bold text-slate-200">
                        {course._count?.assessments || 0}
                      </div>
                      <div className="text-[10px] text-slate-500">CATs</div>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-xs font-bold text-slate-200">
                        {course.credits}
                      </div>
                      <div className="text-[10px] text-slate-500">Credits</div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handlePrepareMe(course.id)}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
                  >
                    <Sparkles className="h-3 w-3" />
                    Briefing
                  </button>
                  <Link
                    href={`/notes?courseId=${course.id}`}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    <FileText className="h-3 w-3" />
                    Course Notes
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. MODAL: "Prepare Me" Briefing */}
      {showPrepareModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">15-Minute Class Briefing</h3>
                  <p className="text-xs text-slate-400">High-yield contextual preparation synthesis</p>
                </div>
              </div>
              <button
                onClick={() => setShowPrepareModal(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {briefingLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-xs">Synthesizing notes, syllabus, and coursework...</span>
              </div>
            ) : briefingData ? (
              <div className="space-y-4 text-xs">
                {/* Course Header */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-blue-400 text-sm">{briefingData.courseCode}</span>
                    <h4 className="text-slate-200 font-semibold">{briefingData.courseName}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">Lecturer: {briefingData.lecturer}</p>
                  </div>
                  <span className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold text-[10px]">
                    ⚡ Ready
                  </span>
                </div>

                {/* Briefing Checklist Items */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                      Last Topic Covered
                    </span>
                    <p className="text-slate-200 font-medium">{briefingData.lastTopic}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                      Current Coursework Status
                    </span>
                    <p className="text-slate-200">{briefingData.currentCoursework}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                      Approaching Assessment
                    </span>
                    <p className="text-slate-200">{briefingData.upcomingAssessment}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <span className="font-bold text-blue-400 uppercase text-[10px] tracking-wider block mb-1">
                      Recommended 15-Minute Action
                    </span>
                    <p className="text-blue-200 font-medium">{briefingData.suggestedPreparation}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowPrepareModal(false)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all"
                  >
                    Got It, Ready for Class
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Unable to synthesize briefing. Please ensure course data is configured.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL: Sync Moodle / Import */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Academic Data Ingestion & Moodle Sync</h3>
                  <p className="text-xs text-slate-400">Automated synchronization with deduplication</p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sync Modes */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "MANUAL_IMPORT", label: "JSON Import" },
                { id: "ICAL_SYNC", label: "iCal Feed" },
                { id: "MOODLE_REST", label: "Moodle API" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSyncMode(m.id as any)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    syncMode === m.id
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {syncMode === "MANUAL_IMPORT" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Degree Schedule JSON</label>
                  <button
                    type="button"
                    onClick={loadAppliedComputingSample}
                    className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    Load Sample BSc Applied Computing Template
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={jsonImportText}
                  onChange={(e) => setJsonImportText(e.target.value)}
                  placeholder='{"courses": [...], "assignments": [...], "classes": [...]}'
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {syncMode === "ICAL_SYNC" && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300">
                  Moodle Private Calendar iCal Feed URL
                </label>
                <input
                  type="url"
                  value={iCalUrl}
                  onChange={(e) => setICalUrl(e.target.value)}
                  placeholder="https://moodle.university.ac.ke/calendar/export_execute.php?..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500">
                  Find this under Moodle &gt; Calendar &gt; Export Calendar &gt; Get calendar URL.
                </p>
              </div>
            )}

            {syncMode === "MOODLE_REST" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Moodle Base URL</label>
                  <input
                    type="url"
                    value={moodleUrl}
                    onChange={(e) => setMoodleUrl(e.target.value)}
                    placeholder="https://moodle.university.ac.ke"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Web Service Token</label>
                  <input
                    type="password"
                    value={moodleToken}
                    onChange={(e) => setMoodleToken(e.target.value)}
                    placeholder="Moodle User Security Key"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {syncStatus && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-blue-400 font-mono">
                {syncStatus}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Synchronizing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Execute Sync
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Create Course */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Add University Course</h3>
              <button onClick={() => setShowCourseModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCourse} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Course Code (e.g. BAC 2101)</label>
                <input
                  required
                  type="text"
                  value={newCourse.code}
                  onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                  placeholder="BAC 2101"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Course Name</label>
                <input
                  required
                  type="text"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  placeholder="Object Oriented Programming"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Lecturer / Instructor</label>
                <input
                  type="text"
                  value={newCourse.lecturer}
                  onChange={(e) => setNewCourse({ ...newCourse, lecturer: e.target.value })}
                  placeholder="Dr. Njoroge"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Semester</label>
                  <input
                    type="text"
                    value={newCourse.semester}
                    onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Course Color</label>
                  <input
                    type="color"
                    value={newCourse.color}
                    onChange={(e) => setNewCourse({ ...newCourse, color: e.target.value })}
                    className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer px-1 py-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: Create Assignment */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Add Academic Assignment</h3>
              <button onClick={() => setShowAssignmentModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Associated Course</label>
                <select
                  required
                  value={newAssign.courseId}
                  onChange={(e) => setNewAssign({ ...newAssign, courseId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Assignment Title</label>
                <input
                  required
                  type="text"
                  value={newAssign.title}
                  onChange={(e) => setNewAssign({ ...newAssign, title: e.target.value })}
                  placeholder="e.g. Lab 4: Binary Trees"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Due Date</label>
                  <input
                    required
                    type="date"
                    value={newAssign.dueDate}
                    onChange={(e) => setNewAssign({ ...newAssign, dueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Est. Minutes</label>
                  <input
                    type="number"
                    value={newAssign.estimatedMinutes}
                    onChange={(e) => setNewAssign({ ...newAssign, estimatedMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Moodle Submission Link (Optional)</label>
                <input
                  type="url"
                  value={newAssign.submissionUrl}
                  onChange={(e) => setNewAssign({ ...newAssign, submissionUrl: e.target.value })}
                  placeholder="https://moodle.university.ac.ke/mod/assign/view.php?id=..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: Create CAT / Exam */}
      {showAssessmentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Add CAT / Exam</h3>
              <button onClick={() => setShowAssessmentModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAssessment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Course</label>
                <select
                  required
                  value={newAssessment.courseId}
                  onChange={(e) => setNewAssessment({ ...newAssessment, courseId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Assessment Title</label>
                  <input
                    required
                    type="text"
                    value={newAssessment.title}
                    onChange={(e) => setNewAssessment({ ...newAssessment, title: e.target.value })}
                    placeholder="CAT 1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Assessment Type</label>
                  <select
                    value={newAssessment.type}
                    onChange={(e) => setNewAssessment({ ...newAssessment, type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CAT_1">CAT 1</option>
                    <option value="CAT_2">CAT 2</option>
                    <option value="EXAM">Final Exam</option>
                    <option value="PRACTICAL">Lab Practical</option>
                    <option value="QUIZ">Quiz</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Date</label>
                  <input
                    required
                    type="date"
                    value={newAssessment.date}
                    onChange={(e) => setNewAssessment({ ...newAssessment, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Weight (% of grade)</label>
                  <input
                    type="number"
                    value={newAssessment.weightPercent}
                    onChange={(e) => setNewAssessment({ ...newAssessment, weightPercent: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Topics Covered</label>
                <input
                  type="text"
                  value={newAssessment.topicsCovered}
                  onChange={(e) => setNewAssessment({ ...newAssessment, topicsCovered: e.target.value })}
                  placeholder="e.g. Weeks 1-4: Asymptotic notation, Recursion"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAssessmentModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                >
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. MODAL: Create Class */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Add Timetable Class Session</h3>
              <button onClick={() => setShowClassModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateClass} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Course</label>
                <select
                  required
                  value={newClass.courseId}
                  onChange={(e) => setNewClass({ ...newClass, courseId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Day</label>
                  <select
                    value={newClass.dayOfWeek}
                    onChange={(e) => setNewClass({ ...newClass, dayOfWeek: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={0}>Sunday</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newClass.startTime}
                    onChange={(e) => setNewClass({ ...newClass, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">End Time</label>
                  <input
                    type="time"
                    value={newClass.endTime}
                    onChange={(e) => setNewClass({ ...newClass, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Room / Venue</label>
                <input
                  type="text"
                  value={newClass.room}
                  onChange={(e) => setNewClass({ ...newClass, room: e.target.value })}
                  placeholder="e.g. Lab C-04 / LT2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isOnlineClass"
                  checked={newClass.isOnline}
                  onChange={(e) => setNewClass({ ...newClass, isOnline: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                />
                <label htmlFor="isOnlineClass" className="text-slate-300">
                  Online / Virtual Lecture
                </label>
              </div>
              {newClass.isOnline && (
                <div>
                  <label className="text-slate-400 block mb-1">Meeting Link (Teams/Zoom/Google Meet)</label>
                  <input
                    type="url"
                    value={newClass.meetingUrl}
                    onChange={(e) => setNewClass({ ...newClass, meetingUrl: e.target.value })}
                    placeholder="https://teams.microsoft.com/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CompassIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
