"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Plus,
  Trash2,
  Edit3,
  FolderGit2,
  Tag,
  Loader2,
  X,
  Eye,
  Calendar,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ProjectOption {
  id: string;
  name: string;
  color?: string | null;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  category?: string | null;
  tags?: string | null;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // View Note Modal
  const [viewingNote, setViewingNote] = useState<NoteItem | null>(null);

  // Create Note Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createProjectId, setCreateProjectId] = useState("");
  const [createCategory, setCreateCategory] = useState("General");
  const [createTags, setCreateTags] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Edit Note Modal
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Confirmation
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<NoteItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  };

  const fetchNotes = async () => {
    try {
      const url = new URL("/api/notes", window.location.origin);
      if (searchQuery.trim()) url.searchParams.set("q", searchQuery.trim());
      if (selectedProjectId !== "ALL") url.searchParams.set("projectId", selectedProjectId);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes || []);
        if (viewingNote) {
          const updated = (data.notes || []).find((n: NoteItem) => n.id === viewingNote.id);
          if (updated) setViewingNote(updated);
        }
      }
    } catch (e) {
      console.error("Failed to load notes:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const pid = urlParams.get("projectId");
      if (pid) {
        setSelectedProjectId(pid);
        setCreateProjectId(pid);
      }
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchNotes();
  }, [selectedProjectId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNotes();
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          content: createContent,
          projectId: createProjectId || null,
          category: createCategory.trim() || "General",
          tags: createTags.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateTitle("");
        setCreateContent("");
        setCreateProjectId("");
        setCreateCategory("General");
        setCreateTags("");
        setShowCreateModal(false);
        fetchNotes();
      }
    } catch (e) {
      console.error("Failed to create note:", e);
    } finally {
      setIsCreating(false);
    }
  };

  const openEditNote = (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || "");
    setEditProjectId(note.projectId || "");
    setEditCategory(note.category || "General");
    setEditTags(note.tags || "");
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editTitle.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingNote.id,
          title: editTitle.trim(),
          content: editContent,
          projectId: editProjectId || null,
          category: editCategory.trim() || "General",
          tags: editTags.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingNote(null);
        fetchNotes();
      }
    } catch (e) {
      console.error("Failed to update note:", e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteConfirmNote || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/notes?id=${deleteConfirmNote.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (viewingNote?.id === deleteConfirmNote.id) {
          setViewingNote(null);
        }
        setDeleteConfirmNote(null);
        fetchNotes();
      }
    } catch (e) {
      console.error("Failed to delete note:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <FileText className="h-3.5 w-3.5" />
            Second Brain & Documentation
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Notes & Second Brain
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Capture, link to projects, and organize notes, architecture logs, and ideas.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Note</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search notes by title, content, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-slate-500" />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Loading second brain...</span>
        </div>
      ) : notes.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 p-8 rounded-2xl bg-slate-900/40 border border-slate-800">
          No notes found. Click &quot;New Note&quot; to capture your first document.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => setViewingNote(note)}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 cursor-pointer group/card"
            >
              <div className="space-y-2">
                {/* Note Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-white group-hover/card:text-blue-400 transition-colors line-clamp-1">
                    {note.title}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => openEditNote(note, e)}
                      title="Edit Note"
                      className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmNote(note);
                      }}
                      title="Delete Note"
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Linked Project Badge */}
                {note.project ? (
                  <div className="flex items-center gap-1.5 w-fit">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: note.project.color || "#3b82f6" }}
                    />
                    <span className="text-[11px] font-medium text-blue-400">
                      {note.project.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 italic block">No linked project</span>
                )}

                {/* Content Preview */}
                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed font-sans">
                  {note.content || "Empty note content."}
                </p>
              </div>

              {/* Footer with Tags and Date */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-500" />
                  {formatDate(note.updatedAt || note.createdAt)}
                </span>
                {note.category && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                    {note.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW NOTE MODAL */}
      {viewingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {viewingNote.project && (
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1.5"
                      style={{
                        backgroundColor: viewingNote.project.color ? `${viewingNote.project.color}20` : "#3b82f620",
                        borderColor: viewingNote.project.color ? `${viewingNote.project.color}40` : "#3b82f640",
                        color: viewingNote.project.color || "#3b82f6",
                      }}
                    >
                      <FolderGit2 className="h-3 w-3" />
                      {viewingNote.project.name}
                    </span>
                  )}
                  {viewingNote.category && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {viewingNote.category}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white leading-snug">{viewingNote.title}</h2>
              </div>
              <button
                onClick={() => setViewingNote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Note Markdown / Body */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed min-h-48 font-mono">
              {viewingNote.content || "No content."}
            </div>

            {/* Tags if any */}
            {viewingNote.tags && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Tag className="h-3.5 w-3.5 text-slate-500" />
                <span>Tags: {viewingNote.tags}</span>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                Last updated {formatDate(viewingNote.updatedAt || viewingNote.createdAt)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditNote(viewingNote)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-200 font-semibold transition-colors cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5 text-blue-400" />
                  <span>Edit Note</span>
                </button>
                <button
                  onClick={() => setDeleteConfirmNote(viewingNote)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NOTE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-400" />
                Create New Note
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Note Title</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Database Sharding Strategy"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Link to Project</label>
                  <select
                    value={createProjectId}
                    onChange={(e) => setCreateProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">No Project (Standalone)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Architecture, Brainstorm, Work"
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Content / Markdown Body</label>
                <textarea
                  rows={6}
                  placeholder="Draft your note, bullet points, technical specifications, or takeaways..."
                  value={createContent}
                  onChange={(e) => setCreateContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Tags (Optional)</label>
                <input
                  type="text"
                  placeholder="database, design, api"
                  value={createTags}
                  onChange={(e) => setCreateTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!createTitle.trim() || isCreating}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? "Saving..." : "Save Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT NOTE MODAL */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-400" />
                Edit Note
              </h2>
              <button onClick={() => setEditingNote(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateNote} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Note Title</label>
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
                  <label className="text-slate-300 block mb-1 font-medium">Link to Project</label>
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">No Project (Standalone)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Content / Markdown Body</label>
                <textarea
                  rows={6}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Tags</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
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

      {/* DELETE NOTE CONFIRMATION */}
      {deleteConfirmNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-white">Delete Note?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteConfirmNote.title}&quot;</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmNote(null)}
                className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteNote}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
