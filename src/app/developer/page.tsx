"use client";

import { useState, useEffect } from "react";
import {
  Terminal,
  Key,
  Server,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileCode2,
  RefreshCw,
} from "lucide-react";

interface Credential {
  id: string;
  serviceName: string;
  environment: string;
  keyName: string;
  keyValue: string;
  isSecret: boolean;
  port?: number | null;
  url?: string | null;
  notes?: string | null;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

interface PortAllocation {
  port: number;
  services: string[];
  hasConflict: boolean;
}

export default function DeveloperHubPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [portAllocations, setPortAllocations] = useState<PortAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & State
  const [selectedEnv, setSelectedEnv] = useState<string>("ALL");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [revealedIds, setRevealedIds] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // Modal Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formServiceName, setFormServiceName] = useState("");
  const [formKeyName, setFormKeyName] = useState("");
  const [formKeyValue, setFormKeyValue] = useState("");
  const [formEnv, setFormEnv] = useState("development");
  const [formPort, setFormPort] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formIsSecret, setFormIsSecret] = useState(true);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/developer");
      const data = await res.json();
      if (data.success) {
        setCredentials(data.credentials);
        setProjects(data.projects);
        setPortAllocations(data.portAllocations);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportDotEnv = () => {
    const lines = filteredCredentials.map(
      (c) => `${c.keyName}=${c.keyValue} # ${c.serviceName}`
    );
    const envContent = `# Exported from Faida OS Developer Hub (${selectedEnv})\n` + lines.join("\n");
    navigator.clipboard.writeText(envContent);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credential?")) return;
    try {
      await fetch(`/api/developer?id=${id}`, { method: "DELETE" });
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formServiceName || !formKeyName || !formKeyValue) return;

    try {
      const res = await fetch("/api/developer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: formServiceName,
          keyName: formKeyName,
          keyValue: formKeyValue,
          environment: formEnv,
          port: formPort ? parseInt(formPort, 10) : null,
          url: formUrl,
          notes: formNotes,
          projectId: formProjectId || null,
          isSecret: formIsSecret,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setFormServiceName("");
        setFormKeyName("");
        setFormKeyValue("");
        setFormPort("");
        setFormUrl("");
        setFormNotes("");
        fetchCredentials();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredCredentials = credentials.filter((c) => {
    if (selectedEnv !== "ALL" && c.environment !== selectedEnv) return false;
    if (selectedProject !== "ALL" && c.projectId !== selectedProject) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Terminal className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Developer &amp; Configuration Hub
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Store environment variables, encrypted API credentials, and local service port maps
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportDotEnv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-semibold cursor-pointer transition-colors shadow-sm"
          >
            {copiedEnv ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied .env to Clipboard!</span>
              </>
            ) : (
              <>
                <FileCode2 className="h-3.5 w-3.5 text-blue-400" />
                <span>Export .env</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm shadow-blue-500/20"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Credential</span>
          </button>
        </div>
      </div>

      {/* Port Allocation Watcher */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Server className="h-4 w-4 text-emerald-400" />
            <span>Local Port Registry</span>
            <span className="text-[10px] text-slate-500 font-normal">
              (Prevents local collision between background dev servers)
            </span>
          </div>
          <button
            onClick={fetchCredentials}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {portAllocations.length === 0 ? (
            <div className="col-span-full text-xs text-slate-500 py-2">
              No local ports assigned yet.
            </div>
          ) : (
            portAllocations.map((pa) => (
              <div
                key={pa.port}
                className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                  pa.hasConflict
                    ? "bg-rose-950/20 border-rose-500/40 text-rose-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-100">
                    :{pa.port}
                  </span>
                  {pa.hasConflict ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-1">
                  {pa.services.join(", ")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Environment Filter */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs overflow-x-auto max-w-full">
          {["ALL", "development", "staging", "production", "local"].map((env) => (
            <button
              key={env}
              onClick={() => setSelectedEnv(env)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium capitalize cursor-pointer transition-colors whitespace-nowrap ${
                selectedEnv === env
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {env}
            </button>
          ))}
        </div>

        {/* Project Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Project:</span>
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

      {/* Credentials Table / Grid */}
      <div className="border border-slate-800/80 rounded-2xl bg-slate-900/50 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading credentials...</div>
        ) : filteredCredentials.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No developer credentials found matching this filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredCredentials.map((c) => {
              const isRevealed = revealedIds[c.id];
              const isCopied = copiedId === c.id;

              return (
                <div
                  key={c.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                >
                  {/* Left: Service & Key */}
                  <div className="space-y-1 md:w-1/3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        {c.serviceName}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase ${
                          c.environment === "production"
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : c.environment === "staging"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {c.environment}
                      </span>
                      {c.project && (
                        <span className="text-[10px] text-slate-400 px-1.5 py-0.2 rounded bg-slate-800">
                          {c.project.name}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-blue-400 font-semibold flex items-center gap-1.5">
                      <Key className="h-3 w-3 text-slate-500" />
                      <span>{c.keyName}</span>
                    </div>
                    {c.notes && (
                      <p className="text-[11px] text-slate-500 leading-snug">{c.notes}</p>
                    )}
                  </div>

                  {/* Middle: Secret Value with Masking */}
                  <div className="flex-1 max-w-md">
                    <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2">
                      <div className="flex-1 font-mono text-xs text-slate-300 truncate">
                        {c.isSecret && !isRevealed
                          ? "••••••••••••••••••••••••••••"
                          : c.keyValue}
                      </div>

                      {c.isSecret && (
                        <button
                          onClick={() => toggleReveal(c.id)}
                          className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                          title={isRevealed ? "Hide Secret" : "Reveal Secret"}
                        >
                          {isRevealed ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => copyToClipboard(c.id, c.keyValue)}
                        className="text-slate-400 hover:text-white p-1 cursor-pointer"
                        title="Copy Value"
                      >
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right: Port, Link, Actions */}
                  <div className="flex items-center justify-end gap-2.5 w-full md:w-1/4 pt-1 md:pt-0 border-t md:border-t-0 border-slate-850">
                    {c.port && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        :{c.port}
                      </span>
                    )}

                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                        title="Open Dashboard"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                      title="Delete Credential"
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

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Add Developer Credential</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Service Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Supabase, Vercel"
                    value={formServiceName}
                    onChange={(e) => setFormServiceName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Environment</label>
                  <select
                    value={formEnv}
                    onChange={(e) => setFormEnv(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                    <option value="local">Local</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Key / Variable Name</label>
                  <input
                    type="text"
                    placeholder="e.g. DATABASE_URL"
                    value={formKeyName}
                    onChange={(e) => setFormKeyName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Assigned Project</label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">(No specific project)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Secret / Config Value</label>
                <textarea
                  placeholder="Paste connection string, API key, or token..."
                  value={formKeyValue}
                  onChange={(e) => setFormKeyValue(e.target.value)}
                  required
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Local Port (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 3000, 5432"
                    value={formPort}
                    onChange={(e) => setFormPort(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Dashboard / Service URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Primary production pooler connection"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="secretCheckbox"
                  checked={formIsSecret}
                  onChange={(e) => setFormIsSecret(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <label htmlFor="secretCheckbox" className="text-slate-300">
                  Mask this value by default (Secret)
                </label>
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
                  Save Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
