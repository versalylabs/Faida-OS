"use client";

import { useState, useEffect } from "react";
import {
  FolderArchive,
  FileText,
  FileCode,
  Image as ImageIcon,
  Receipt,
  GraduationCap,
  Briefcase,
  Search,
  Plus,
  Trash2,
  Copy,
  Check,
  HardDrive,
  Filter,
  Tag,
} from "lucide-react";

interface FileAsset {
  id: string;
  name: string;
  filePath: string;
  fileType: string;
  fileSize?: number | null;
  category: string;
  projectId?: string | null;
  tags?: string | null;
  description?: string | null;
  createdAt: string;
  project?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

interface Metrics {
  totalFiles: number;
  totalBytes: number;
  categoryCounts: { [cat: string]: number };
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalFiles: 0,
    totalBytes: 0,
    categoryCounts: {},
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPath, setFormPath] = useState("");
  const [formType, setFormType] = useState("PDF");
  const [formSizeKB, setFormSizeKB] = useState("");
  const [formCategory, setFormCategory] = useState("PROJECT_ASSET");
  const [formProjectId, setFormProjectId] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (selectedProject !== "ALL") params.set("projectId", selectedProject);
      if (searchQuery.trim()) params.set("query", searchQuery.trim());

      const res = await fetch(`/api/files?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
        setProjects(data.projects);
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [selectedCategory, selectedProject, searchQuery]);

  const copyPath = (id: string, path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this indexed file record?")) return;
    try {
      await fetch(`/api/files?id=${id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      fetchFiles();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPath) return;

    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          filePath: formPath,
          fileType: formType,
          fileSize: formSizeKB ? Math.round(parseFloat(formSizeKB) * 1024) : null,
          category: formCategory,
          projectId: formProjectId || null,
          tags: formTags,
          description: formDescription,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setFormName("");
        setFormPath("");
        setFormSizeKB("");
        setFormTags("");
        setFormDescription("");
        fetchFiles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string, category: string) => {
    if (category === "RECEIPT_INVOICE") return <Receipt className="h-4 w-4 text-emerald-400" />;
    if (category === "LEARNING_RESOURCE") return <GraduationCap className="h-4 w-4 text-purple-400" />;
    if (type === "CODE") return <FileCode className="h-4 w-4 text-cyan-400" />;
    if (type === "IMAGE") return <ImageIcon className="h-4 w-4 text-indigo-400" />;
    return <FileText className="h-4 w-4 text-blue-400" />;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FolderArchive className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Smart File &amp; Asset Organizer
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organize project deliverables, invoices, receipts, code snapshots, and learning resources
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm shadow-blue-500/20 self-start md:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Index File</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Assets</span>
            <HardDrive className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-slate-100">{metrics.totalFiles} indexed</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {formatFileSize(metrics.totalBytes)} total tracked
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Project Assets</span>
            <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-100">
            {metrics.categoryCounts["PROJECT_ASSET"] || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Diagrams, decks &amp; deliverables</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Invoices &amp; Receipts</span>
            <Receipt className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-100">
            {metrics.categoryCounts["RECEIPT_INVOICE"] || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Linked to KES Finance ledger</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Learning &amp; Code</span>
            <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-100">
            {(metrics.categoryCounts["LEARNING_RESOURCE"] || 0) +
              (metrics.categoryCounts["CODE_SNIPPET"] || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Study docs &amp; code backups</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: "ALL", label: "All Assets" },
            { id: "PROJECT_ASSET", label: "Project Assets" },
            { id: "RECEIPT_INVOICE", label: "Receipts & Invoices" },
            { id: "LEARNING_RESOURCE", label: "Learning" },
            { id: "CODE_SNIPPET", label: "Code & Backups" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${
                selectedCategory === cat.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 md:w-56">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search file, tag, path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Project Dropdown */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
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

      {/* Files List / Grid */}
      <div className="border border-slate-800/80 rounded-2xl bg-slate-900/50 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No indexed files found matching your filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {files.map((file) => {
              const isCopied = copiedId === file.id;

              return (
                <div
                  key={file.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                >
                  {/* Left: Icon & Title & Description */}
                  <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0 mt-0.5">
                      {getFileIcon(file.fileType, file.category)}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-100 truncate">
                          {file.name}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase shrink-0">
                          {file.fileType}
                        </span>
                        {file.project && (
                          <span className="text-[10px] text-blue-400 px-1.5 py-0.2 rounded bg-blue-500/10 border border-blue-500/20 shrink-0">
                            {file.project.name}
                          </span>
                        )}
                      </div>

                      {file.description && (
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                          {file.description}
                        </p>
                      )}

                      {/* File Path & Tags */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono truncate">
                        <span className="truncate">{file.filePath}</span>
                        {file.tags && (
                          <div className="hidden sm:flex items-center gap-1 text-slate-400 shrink-0">
                            <Tag className="h-2.5 w-2.5 text-slate-500" />
                            <span>{file.tags}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: File Size & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-2.5 sm:gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80 shrink-0">
                    <span className="text-xs font-mono text-slate-400">
                      {formatFileSize(file.fileSize)}
                    </span>

                    <button
                      onClick={() => copyPath(file.id, file.filePath)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs cursor-pointer transition-colors"
                      title="Copy File Path"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400 text-[10px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span className="text-[10px]">Copy Path</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(file.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 cursor-pointer transition-colors"
                      title="Delete Record"
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

      {/* Index File Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Index Local File / Deliverable</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">File Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q3_Financial_Forecast.pdf"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Local Relative or Absolute Path</label>
                <input
                  type="text"
                  placeholder="e.g. docs/financials/Q3_Forecast.pdf"
                  value={formPath}
                  onChange={(e) => setFormPath(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="PROJECT_ASSET">Project Asset</option>
                    <option value="RECEIPT_INVOICE">Receipt / Invoice</option>
                    <option value="LEARNING_RESOURCE">Learning Resource</option>
                    <option value="CODE_SNIPPET">Code Snippet / Backup</option>
                    <option value="PERSONAL_DOC">Personal Document</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">File Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="PDF">PDF</option>
                    <option value="IMAGE">Image</option>
                    <option value="CODE">Code / Script</option>
                    <option value="SPREADSHEET">Spreadsheet</option>
                    <option value="DOCUMENT">Document</option>
                    <option value="ARCHIVE">Archive (.zip, .tar)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Project Association</label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">(None / General)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Estimated Size (KB)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1500"
                    value={formSizeKB}
                    onChange={(e) => setFormSizeKB(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. q3, revenue, deck, client"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description / Notes</label>
                <textarea
                  placeholder="What is this file for? What does it contain?"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
                >
                  Index File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
