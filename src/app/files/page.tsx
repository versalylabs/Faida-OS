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
  UploadCloud,
  Download,
  Eye,
  ExternalLink,
  Loader2,
  X,
  FileUp,
} from "lucide-react";
import { offlineFetch, cacheOfflineData, getCachedOfflineData } from "@/lib/offlineSync";

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

  // Add/Upload Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<"DEVICE" | "PATH">("DEVICE");
  const [selectedDeviceFile, setSelectedDeviceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

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

      const res = await offlineFetch(`/api/files?${params.toString()}`, { cacheKey: "files_assets" });
      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
        setProjects(data.projects || []);
        setMetrics(data.metrics || { totalFiles: 0, totalBytes: 0, categoryCounts: {} });
        cacheOfflineData("files_assets", data);
      }
    } catch (e) {
      console.error("Failed to load files:", e);
      const cached = getCachedOfflineData<any>("files_assets");
      if (cached) {
        setFiles(cached.files || []);
        setProjects(cached.projects || []);
        setMetrics(cached.metrics || { totalFiles: 0, totalBytes: 0, categoryCounts: {} });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();

    const handleSync = () => fetchFiles();
    window.addEventListener("faida-sync-completed", handleSync);
    return () => window.removeEventListener("faida-sync-completed", handleSync);
  }, [selectedCategory, selectedProject, searchQuery]);

  const copyPath = (id: string, path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this indexed file record?")) return;
    try {
      await offlineFetch(`/api/files?id=${id}`, {
        method: "DELETE",
        description: `Delete file asset ${id}`,
      });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      fetchFiles();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeviceFileSelect = (file: File) => {
    setSelectedDeviceFile(file);
    if (!formName.trim()) {
      setFormName(file.name);
    }
    setFormSizeKB((file.size / 1024).toFixed(1));
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext || "")) {
      setFormType("IMAGE");
    } else if (ext === "pdf") {
      setFormType("PDF");
    } else if (["ts", "tsx", "js", "jsx", "py", "sql", "json", "html"].includes(ext || "")) {
      setFormType("CODE");
    } else if (["xlsx", "xls", "csv"].includes(ext || "")) {
      setFormType("SPREADSHEET");
    } else if (["zip", "tar", "gz", "7z", "rar"].includes(ext || "")) {
      setFormType("ARCHIVE");
    } else {
      setFormType("DOCUMENT");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (uploadMode === "DEVICE") {
      if (!selectedDeviceFile) {
        alert("Please select a file to upload from your device.");
        return;
      }

      setIsSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedDeviceFile);
        if (formName.trim()) formData.append("name", formName.trim());
        formData.append("category", formCategory);
        if (formProjectId) formData.append("projectId", formProjectId);
        if (formTags.trim()) formData.append("tags", formTags.trim());
        if (formDescription.trim()) formData.append("description", formDescription.trim());

        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          setShowAddModal(false);
          setSelectedDeviceFile(null);
          setFormName("");
          setFormPath("");
          setFormSizeKB("");
          setFormTags("");
          setFormDescription("");
          fetchFiles();
        } else {
          alert(data.error || "Failed to upload file");
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        alert("Failed to upload file: " + err.message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // PATH mode
      if (!formName || !formPath) return;

      setIsSubmitting(true);
      try {
        const res = await offlineFetch("/api/files", {
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
          description: `Index file "${formName}"`,
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
      } finally {
        setIsSubmitting(false);
      }
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
          onClick={() => {
            setUploadMode("DEVICE");
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm shadow-blue-500/20 self-start md:self-auto"
        >
          <UploadCloud className="h-4 w-4" />
          <span>Upload / Add File</span>
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
                  <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2.5 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80 shrink-0 flex-wrap">
                    <span className="text-xs font-mono text-slate-400 mr-1">
                      {formatFileSize(file.fileSize)}
                    </span>

                    {/* View / Open Button if uploaded asset */}
                    {file.filePath.startsWith("/uploads/") && (
                      <>
                        <a
                          href={file.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-xs font-medium transition-colors"
                          title="Open in new tab"
                        >
                          <Eye className="h-3 w-3" />
                          <span className="text-[10px] hidden sm:inline">View</span>
                        </a>

                        <a
                          href={file.filePath}
                          download={file.name}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
                          title="Download file to device"
                        >
                          <Download className="h-3 w-3 text-emerald-400" />
                          <span className="text-[10px] hidden sm:inline">Save</span>
                        </a>
                      </>
                    )}

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
                          <span className="text-[10px]">Copy</span>
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

      {/* Add / Upload File Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <UploadCloud className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100">Add File &amp; Asset</h2>
                  <p className="text-[10px] text-slate-400">Upload from device or index local path</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedDeviceFile(null);
                }}
                className="text-slate-400 hover:text-slate-200 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setUploadMode("DEVICE")}
                className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  uploadMode === "DEVICE"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileUp className="h-3.5 w-3.5" />
                <span>Upload from Device</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("PATH")}
                className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  uploadMode === "PATH"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Index Local Path</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              {uploadMode === "DEVICE" ? (
                /* DEVICE UPLOAD DROPZONE */
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Select File from Phone or Computer
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleDeviceFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative ${
                      isDragOver
                        ? "border-blue-400 bg-blue-500/10"
                        : selectedDeviceFile
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : "border-slate-700 bg-slate-950/60 hover:border-slate-600"
                    }`}
                    onClick={() => {
                      const input = document.getElementById("device-file-input") as HTMLInputElement;
                      if (input) input.click();
                    }}
                  >
                    <input
                      id="device-file-input"
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleDeviceFileSelect(e.target.files[0]);
                        }
                      }}
                    />

                    {selectedDeviceFile ? (
                      <div className="space-y-1.5">
                        <div className="inline-flex p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                          <Check className="h-5 w-5" />
                        </div>
                        <div className="font-bold text-white text-xs truncate max-w-xs mx-auto">
                          {selectedDeviceFile.name}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                          {formatFileSize(selectedDeviceFile.size)} • Type: {formType}
                        </div>
                        <span className="text-[10px] text-slate-400 underline block pt-1">
                          Click to select a different file
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 text-blue-400">
                          <UploadCloud className="h-6 w-6" />
                        </div>
                        <div className="text-xs font-semibold text-slate-200">
                          Click or drag a file here to upload
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Documents, PDFs, Images, Code, Spreadsheets &amp; Archives (Up to 50MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* LOCAL PATH INPUT */
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Local Relative or Absolute Path</label>
                  <input
                    type="text"
                    placeholder="e.g. docs/financials/Q3_Forecast.pdf or https://..."
                    value={formPath}
                    onChange={(e) => setFormPath(e.target.value)}
                    required={uploadMode === "PATH"}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Asset Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q3_Financial_Forecast.pdf"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
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
                    <option value="MEDIA">Audio / Video</option>
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. q3, revenue, deck, client, versaly"
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
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedDeviceFile(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (uploadMode === "DEVICE" && !selectedDeviceFile)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{uploadMode === "DEVICE" ? "Uploading..." : "Saving..."}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3.5 w-3.5" />
                      <span>{uploadMode === "DEVICE" ? "Upload Asset" : "Index File"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
