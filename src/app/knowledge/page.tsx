"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  Tag,
  Loader2,
  Sparkles,
  Link2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface NoteItem {
  id: string;
  title: string;
  content: string;
  category?: string | null;
  tags?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgePage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // New Note Modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("Databases");
  const [newTags, setNewTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNotes = async () => {
    try {
      const url = new URL("/api/knowledge", window.location.origin);
      if (searchQuery.trim()) url.searchParams.set("q", searchQuery.trim());
      if (selectedCategory !== "ALL") url.searchParams.set("category", selectedCategory);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes);
      }
    } catch (e) {
      console.error("Failed to load knowledge notes:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNotes();
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent,
          category: newCategory,
          tags: newTags,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewTitle("");
        setNewContent("");
        setNewTags("");
        setShowModal(false);
        fetchNotes();
      }
    } catch (e) {
      console.error("Failed to create note:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
    try {
      await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    } catch (e) {
      fetchNotes();
    }
  };

  const categories = ["ALL", "Databases", "Frontend", "Backend", "Architecture", "General"];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono tracking-wider uppercase mb-1">
            <BookOpen className="h-3.5 w-3.5" />
            Connected Second Brain
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Knowledge Base
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Structured long-term memory linking notes, research, projects, and learning topics.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Note</span>
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          placeholder='Ask or search your knowledge base... (e.g. "PostgreSQL", "MVCC", "Server Actions")'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl py-3.5 pl-11 pr-24 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 shadow-xl"
        />
        <Search className="h-4 w-4 text-slate-500 absolute left-4 top-3.5" />
        <button
          type="submit"
          className="absolute right-2 top-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
        >
          Search
        </button>
      </form>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Notes Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span>Scanning second brain...</span>
        </div>
      ) : notes.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 p-8 rounded-2xl bg-slate-900/40 border border-slate-800">
          No knowledge notes found matching your search. Capture a note above or use Universal Capture.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {notes.map((note) => {
            const tagList = note.tags
              ? note.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
              : [];

            return (
              <div
                key={note.id}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-4 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {note.category || "General"}
                    </span>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded cursor-pointer transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100">{note.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-4 whitespace-pre-line">
                    {note.content}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tagList.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-slate-500 font-mono text-[10px]">
                    {formatDate(note.updatedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Note Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-bold text-white">Create Knowledge Note</h2>
            <form onSubmit={handleCreateNote} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Title</label>
                <input
                  type="text"
                  placeholder="e.g. PostgreSQL MVCC Architecture"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Databases">Databases</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Backend">Backend</option>
                    <option value="Architecture">Architecture</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="postgresql, indexes, melio"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Markdown Content</label>
                <textarea
                  rows={6}
                  placeholder="Write your note, code snippet, or observations..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
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
                  disabled={!newTitle.trim() || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save to Knowledge Base"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
