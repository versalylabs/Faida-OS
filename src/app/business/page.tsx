"use client";

import { useState, useEffect } from "react";
import {
  Briefcase,
  Building2,
  TrendingUp,
  Target,
  Users,
  CheckSquare,
  Clock,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Send,
  MessageSquare,
  PhoneCall,
  UserCheck,
  Award,
  Zap,
  DollarSign,
  Layers,
  X,
  Loader2,
  Filter,
} from "lucide-react";
import { formatKES, formatDate } from "@/lib/utils";

interface DeliverableItem {
  id: string;
  businessId: string;
  clientId?: string | null;
  title: string;
  description?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

interface ClientItem {
  id: string;
  businessId: string;
  name: string;
  industry?: string | null;
  scope?: string | null;
  status: "ACTIVE" | "ONBOARDING" | "LEAD" | "PROPOSAL" | "COMPLETED" | "PAUSED" | string;
  contractType: "RETAINER" | "MILESTONE" | "ONE_TIME" | string;
  contractValue: number;
  billingCycle: "MONTHLY" | "PROJECT" | "QUARTERLY" | string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  health: "HEALTHY" | "ATTENTION" | "AT_RISK" | string;
  notes?: string | null;
  startDate?: string | null;
  createdAt: string;
  deliverables?: DeliverableItem[];
}

interface MetricItem {
  id: string;
  businessId: string;
  weekStartDate: string;
  outreachSent: number;
  replyRateWarm: number;
  replyRateCold: number;
  auditsBooked: number;
  showRate: number;
  closeRate: number;
  avgTimeToLiveDays: number;
  mrr: number;
  clientChurnCount: number;
  referralsCount: number;
  cac: number;
  ltv: number;
  notes?: string | null;
  createdAt: string;
}

interface BusinessItem {
  id: string;
  name: string;
  slug: string;
  type: string;
  description?: string | null;
  color: string;
  mrr: number;
  targetMrr: number;
  currency: string;
  clients: ClientItem[];
  weeklyMetrics: MetricItem[];
  deliverables: DeliverableItem[];
}

interface PortfolioSummary {
  totalBusinesses: number;
  activeClientsCount: number;
  totalContractValue: number;
  totalMrr: number;
  totalDeliverablesCount: number;
  pendingDeliverablesCount: number;
}

export default function BusinessPage() {
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [selectedBusinessSlug, setSelectedBusinessSlug] = useState<"ALL" | "versaly" | "straten">("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Deliverables filter
  const [deliverableStatusFilter, setDeliverableStatusFilter] = useState<string>("ALL");

  // Modals state
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showDeliverableModal, setShowDeliverableModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [deleteClientConfirm, setDeleteClientConfirm] = useState<ClientItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Metric Form State
  const [metricBusinessId, setMetricBusinessId] = useState("");
  const [metricWeek, setMetricWeek] = useState("2026-W42");
  const [metricOutreach, setMetricOutreach] = useState("500");
  const [metricReplyWarm, setMetricReplyWarm] = useState("12");
  const [metricReplyCold, setMetricReplyCold] = useState("3.8");
  const [metricAudits, setMetricAudits] = useState("7");
  const [metricShowRate, setMetricShowRate] = useState("75");
  const [metricCloseRate, setMetricCloseRate] = useState("33");
  const [metricTimeToLive, setMetricTimeToLive] = useState("22");
  const [metricMrr, setMetricMrr] = useState("165000");
  const [metricChurn, setMetricChurn] = useState("0");
  const [metricReferrals, setMetricReferrals] = useState("1.2");
  const [metricCac, setMetricCac] = useState("15000");
  const [metricLtv, setMetricLtv] = useState("75000");
  const [metricNotes, setMetricNotes] = useState("");

  // Client Form State
  const [clientBusinessId, setClientBusinessId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientIndustry, setClientIndustry] = useState("");
  const [clientScope, setClientScope] = useState("");
  const [clientStatus, setClientStatus] = useState("ACTIVE");
  const [clientContractType, setClientContractType] = useState("RETAINER");
  const [clientContractValue, setClientContractValue] = useState("");
  const [clientBillingCycle, setClientBillingCycle] = useState("MONTHLY");
  const [clientHealth, setClientHealth] = useState("HEALTHY");
  const [clientNotes, setClientNotes] = useState("");

  // Deliverable Form State
  const [delivBusinessId, setDelivBusinessId] = useState("");
  const [delivClientId, setDelivClientId] = useState("");
  const [delivTitle, setDelivTitle] = useState("");
  const [delivDescription, setDelivDescription] = useState("");
  const [delivPriority, setDelivPriority] = useState("MEDIUM");
  const [delivDueDate, setDelivDueDate] = useState("");

  const fetchBusinessData = async () => {
    try {
      const res = await fetch("/api/business", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setBusinesses(data.businesses || []);
        setSummary(data.portfolioSummary || null);
        if (data.businesses.length > 0 && !metricBusinessId) {
          setMetricBusinessId(data.businesses[0].id);
          setClientBusinessId(data.businesses[0].id);
          setDelivBusinessId(data.businesses[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load business data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessData();
  }, []);

  // Filtered lists based on business tab
  const activeBusiness =
    selectedBusinessSlug === "ALL"
      ? null
      : businesses.find((b) => b.slug.toLowerCase() === selectedBusinessSlug.toLowerCase());

  const displayedClients =
    selectedBusinessSlug === "ALL"
      ? businesses.flatMap((b) => b.clients)
      : activeBusiness
      ? activeBusiness.clients
      : [];

  const displayedDeliverables =
    selectedBusinessSlug === "ALL"
      ? businesses.flatMap((b) => b.deliverables)
      : activeBusiness
      ? activeBusiness.deliverables
      : [];

  const filteredDeliverables = displayedDeliverables.filter((d) => {
    if (deliverableStatusFilter === "ALL") return true;
    return d.status === deliverableStatusFilter;
  });

  // Latest weekly metric for active tab or Versaly by default
  const versalyBusiness = businesses.find((b) => b.slug.toLowerCase() === "versaly");
  const stratenBusiness = businesses.find((b) => b.slug.toLowerCase() === "straten");

  const currentMetric = activeBusiness
    ? activeBusiness.weeklyMetrics[0] || null
    : versalyBusiness?.weeklyMetrics[0] || businesses[0]?.weeklyMetrics[0] || null;

  // Handlers
  const handleSaveWeeklyMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricBusinessId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/business/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: metricBusinessId,
          weekStartDate: metricWeek,
          outreachSent: metricOutreach,
          replyRateWarm: metricReplyWarm,
          replyRateCold: metricReplyCold,
          auditsBooked: metricAudits,
          showRate: metricShowRate,
          closeRate: metricCloseRate,
          avgTimeToLiveDays: metricTimeToLive,
          mrr: metricMrr,
          clientChurnCount: metricChurn,
          referralsCount: metricReferrals,
          cac: metricCac,
          ltv: metricLtv,
          notes: metricNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowMetricModal(false);
        fetchBusinessData();
      }
    } catch (err) {
      console.error("Failed to save weekly metric:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientBusinessId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const method = editingClient ? "PATCH" : "POST";
      const payload: any = {
        businessId: clientBusinessId,
        name: clientName.trim(),
        industry: clientIndustry.trim(),
        scope: clientScope.trim(),
        status: clientStatus,
        contractType: clientContractType,
        contractValue: clientContractValue,
        billingCycle: clientBillingCycle,
        health: clientHealth,
        notes: clientNotes.trim(),
      };
      if (editingClient) payload.id = editingClient.id;

      const res = await fetch("/api/business/clients", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setShowClientModal(false);
        setEditingClient(null);
        resetClientForm();
        fetchBusinessData();
      }
    } catch (err) {
      console.error("Failed to save client:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deleteClientConfirm || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/business/clients?id=${deleteClientConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteClientConfirm(null);
        fetchBusinessData();
      }
    } catch (err) {
      console.error("Failed to delete client:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delivTitle.trim() || !delivBusinessId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/business/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: delivBusinessId,
          clientId: delivClientId || null,
          title: delivTitle.trim(),
          description: delivDescription.trim(),
          priority: delivPriority,
          dueDate: delivDueDate || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowDeliverableModal(false);
        setDelivTitle("");
        setDelivDescription("");
        setDelivDueDate("");
        fetchBusinessData();
      }
    } catch (err) {
      console.error("Failed to create deliverable:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDeliverableStatus = async (deliverable: DeliverableItem) => {
    const nextStatus = deliverable.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      const res = await fetch("/api/business/deliverables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deliverable.id, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchBusinessData();
      }
    } catch (err) {
      console.error("Failed to toggle deliverable:", err);
    }
  };

  const resetClientForm = () => {
    setClientName("");
    setClientIndustry("");
    setClientScope("");
    setClientStatus("ACTIVE");
    setClientContractType("RETAINER");
    setClientContractValue("");
    setClientBillingCycle("MONTHLY");
    setClientHealth("HEALTHY");
    setClientNotes("");
  };

  const openEditClient = (client: ClientItem) => {
    setEditingClient(client);
    setClientBusinessId(client.businessId);
    setClientName(client.name);
    setClientIndustry(client.industry || "");
    setClientScope(client.scope || "");
    setClientStatus(client.status);
    setClientContractType(client.contractType);
    setClientContractValue(client.contractValue.toString());
    setClientBillingCycle(client.billingCycle);
    setClientHealth(client.health);
    setClientNotes(client.notes || "");
    setShowClientModal(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Business &amp; Ventures Hub
              </h1>
              <p className="text-xs text-slate-400">
                Command center for Versaly (Software Dev) &amp; Straten (Marketing Agency) work output
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (activeBusiness) setMetricBusinessId(activeBusiness.id);
              setShowMetricModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Log Weekly Numbers</span>
          </button>

          <button
            onClick={() => {
              setEditingClient(null);
              resetClientForm();
              if (activeBusiness) setClientBusinessId(activeBusiness.id);
              setShowClientModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            <span>Add Client</span>
          </button>

          <button
            onClick={() => {
              if (activeBusiness) setDelivBusinessId(activeBusiness.id);
              setShowDeliverableModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
            <span>New Deliverable</span>
          </button>
        </div>
      </div>

      {/* Business Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900/60 border border-slate-800">
        <button
          onClick={() => setSelectedBusinessSlug("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            selectedBusinessSlug === "ALL"
              ? "bg-slate-800 text-white shadow-sm border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Building2 className="h-3.5 w-3.5 text-indigo-400" />
          <span>Portfolio Overview</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
            2 Companies
          </span>
        </button>

        <button
          onClick={() => setSelectedBusinessSlug("versaly")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            selectedBusinessSlug === "versaly"
              ? "bg-blue-600/20 text-blue-300 shadow-sm border border-blue-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Versaly</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
            Software Dev
          </span>
        </button>

        <button
          onClick={() => setSelectedBusinessSlug("straten")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            selectedBusinessSlug === "straten"
              ? "bg-amber-600/20 text-amber-300 shadow-sm border border-amber-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Straten</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
            Marketing Agency
          </span>
        </button>
      </div>

      {/* High-Level Pulse Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total MRR */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">
              {selectedBusinessSlug === "ALL" ? "Combined Monthly Revenue" : `${activeBusiness?.name} MRR`}
            </span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {formatKES(
              selectedBusinessSlug === "ALL"
                ? summary?.totalMrr || 210000
                : activeBusiness?.mrr || 165000
            )}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>Target: {formatKES(activeBusiness?.targetMrr || 850000)}</span>
          </div>
        </div>

        {/* Active Clients */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Active Clients</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {displayedClients.filter((c) => c.status === "ACTIVE").length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <span>Highland Gardens &amp; Linux Learning</span>
          </div>
        </div>

        {/* Weekly Outreach Volume */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Weekly Outreach</span>
            <Send className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {currentMetric?.outreachSent || 500}
            <span className="text-xs text-slate-500 font-normal ml-1">/ 500 target</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <Flame className="h-3 w-3 text-amber-400" />
            <span>100% Weekly Effort Quota</span>
          </div>
        </div>

        {/* Conversion & Unit Economics */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">LTV : CAC Multiplier</span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {currentMetric && currentMetric.cac > 0
              ? `${(currentMetric.ltv / currentMetric.cac).toFixed(1)}×`
              : "5.0×"}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">
            <span>Healthy (Target ≥ 3× CAC)</span>
          </div>
        </div>
      </div>

      {/* Versaly Numbers to Track Every Week (Blueprint Matrix) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-400" />
              <span>Weekly Numbers to Track &amp; Target Blueprint</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal">
                {activeBusiness ? activeBusiness.name : "Versaly Blueprint"}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Systematic KPI benchmarks for effort, message quality, conversion rates, and retention
            </p>
          </div>

          <button
            onClick={() => {
              if (activeBusiness) setMetricBusinessId(activeBusiness.id);
              setShowMetricModal(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-blue-400 font-mono font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Edit3 className="h-3 w-3" />
            <span>Update This Week</span>
          </button>
        </div>

        {/* 10 Metric Blueprint Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
          {/* 1. Outreach Sent */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Outreach Sent</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Effort
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric?.outreachSent || 500}
              <span className="text-xs text-slate-500 font-normal ml-1">/ wk</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">500/week</span>
            </div>
          </div>

          {/* 2. Reply Rate */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Reply Rate</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Quality
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric?.replyRateWarm || 12.0}%
              <span className="text-xs text-slate-500 font-normal ml-1.5">
                ({currentMetric?.replyRateCold || 3.8}% cold)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">10%+ warm, 3–5% cold</span>
            </div>
          </div>

          {/* 3. Audits Booked */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Audits Booked</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Lead Magnet
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric?.auditsBooked || 7}
              <span className="text-xs text-slate-500 font-normal ml-1">calls/wk</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">5–10/week</span>
            </div>
          </div>

          {/* 4. Show Rate */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Show Rate</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Reminders
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric?.showRate || 75.0}%
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">70%+</span>
            </div>
          </div>

          {/* 5. Close Rate (offer -> paid) */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Close Rate</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Sales Strength
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric?.closeRate || 33.3}%
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">25–40%</span>
            </div>
          </div>

          {/* 6. Time to Go-Live */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Time to Go-Live</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Delivery Speed
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric?.avgTimeToLiveDays || 22}
              <span className="text-xs text-slate-500 font-normal ml-1">days</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">&le; 30 days</span>
            </div>
          </div>

          {/* 7. Monthly Recurring Revenue */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Monthly Revenue</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Health
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {formatKES(currentMetric?.mrr || 165000)}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">Growing / mo</span>
            </div>
          </div>

          {/* 8. Client Churn */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Client Churn</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Retention
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric?.clientChurnCount || 0}
              <span className="text-xs text-slate-500 font-normal ml-1">lost</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">0 in first 6 mos</span>
            </div>
          </div>

          {/* 9. Referrals per Client */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">Referrals / Client</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Word of Mouth
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric?.referralsCount || 1.2}
              <span className="text-xs text-slate-500 font-normal ml-1">per client</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">1+</span>
            </div>
          </div>

          {/* 10. CAC vs LTV */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-300">CAC vs LTV</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Unit Economics
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {currentMetric && currentMetric.cac > 0
                ? `${(currentMetric.ltv / currentMetric.cac).toFixed(1)}×`
                : "5.0×"}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>Early Target:</span>
              <span className="font-mono text-emerald-400 font-semibold">LTV &ge; 3&times; CAC</span>
            </div>
          </div>
        </div>

        {currentMetric?.notes && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
            <span className="text-blue-400 font-bold uppercase text-[10px] tracking-wider">Weekly Note:</span>
            <span>{currentMetric.notes}</span>
          </div>
        )}
      </div>

      {/* Client Accounts & Retainer CRM Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <span>Active Client Accounts ({displayedClients.length})</span>
            </h2>
            <p className="text-xs text-slate-400">
              Current active contracts, scopes of work, and retainer status
            </p>
          </div>

          <button
            onClick={() => {
              setEditingClient(null);
              resetClientForm();
              if (activeBusiness) setClientBusinessId(activeBusiness.id);
              setShowClientModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            <span>Add Client</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span>Loading client portfolio...</span>
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 p-8 space-y-2">
            <p className="text-xs text-slate-400">No client accounts found for this filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedClients.map((client) => {
              const clientBusiness = businesses.find((b) => b.id === client.businessId);
              const pendingDelivs = (client.deliverables || []).filter((d) => d.status !== "COMPLETED").length;
              const completedDelivs = (client.deliverables || []).filter((d) => d.status === "COMPLETED").length;

              return (
                <div
                  key={client.id}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-4"
                >
                  {/* Client Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white truncate">{client.name}</h3>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            client.health === "HEALTHY"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : client.health === "ATTENTION"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}
                        >
                          {client.health}
                        </span>
                        {clientBusiness && (
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded border"
                            style={{
                              backgroundColor: `${clientBusiness.color}15`,
                              borderColor: `${clientBusiness.color}30`,
                              color: clientBusiness.color,
                            }}
                          >
                            {clientBusiness.name}
                          </span>
                        )}
                      </div>

                      {client.industry && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="text-slate-500">Industry:</span>
                          <span className="font-medium text-slate-300">{client.industry}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditClient(client)}
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
                        title="Edit Client"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteClientConfirm(client)}
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900 transition-colors cursor-pointer"
                        title="Delete Client"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Scope of Work */}
                  {client.scope && (
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        Scope of Work &amp; Retainer
                      </span>
                      <p className="text-xs text-slate-200 font-medium leading-relaxed">{client.scope}</p>
                    </div>
                  )}

                  {/* Financial & Contract Specs */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Contract Value</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {formatKES(client.contractValue)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {client.billingCycle} • {client.contractType}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Deliverables Status</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-amber-400 font-bold font-mono text-sm">{pendingDelivs}</span>
                        <span className="text-slate-400 text-[11px]">in progress</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-400 font-bold font-mono text-sm">{completedDelivs}</span>
                        <span className="text-slate-400 text-[11px]">done</span>
                      </div>
                    </div>
                  </div>

                  {/* Client Notes */}
                  {client.notes && (
                    <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40 italic">
                      &quot;{client.notes}&quot;
                    </p>
                  )}

                  {/* Footer Action */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setDelivBusinessId(client.businessId);
                        setDelivClientId(client.id);
                        setShowDeliverableModal(true);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Work Deliverable</span>
                    </button>

                    <span className="text-[10px] text-slate-500 font-mono">
                      Active Since {formatDate(client.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Work Output & Client Deliverables Sprint Tracker */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-amber-400" />
              <span>Work Output &amp; Deliverables Sprint ({filteredDeliverables.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live tasks, packaging dielines, social calendars, and MVP delivery milestones
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tabs */}
            <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              {["ALL", "PENDING", "IN_PROGRESS", "REVIEW", "COMPLETED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setDeliverableStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    deliverableStatusFilter === st
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (activeBusiness) setDelivBusinessId(activeBusiness.id);
                setShowDeliverableModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Deliverable</span>
            </button>
          </div>
        </div>

        {/* Deliverables List */}
        {filteredDeliverables.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No deliverables matching filter &quot;{deliverableStatusFilter}&quot;.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredDeliverables.map((item) => {
              const isDone = item.status === "COMPLETED";
              const client = displayedClients.find((c) => c.id === item.clientId);
              const biz = businesses.find((b) => b.id === item.businessId);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    isDone
                      ? "bg-slate-950/40 border-slate-800/40 opacity-70"
                      : "bg-slate-950/80 border-slate-800/90 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => handleToggleDeliverableStatus(item)}
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        isDone
                          ? "bg-emerald-500 border-emerald-400 text-slate-950"
                          : "border-slate-700 hover:border-slate-500 text-transparent"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold truncate ${
                            isDone ? "line-through text-slate-400" : "text-slate-100"
                          }`}
                        >
                          {item.title}
                        </span>

                        {client && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-blue-300">
                            {client.name}
                          </span>
                        )}

                        {biz && !client && (
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded border"
                            style={{
                              backgroundColor: `${biz.color}15`,
                              borderColor: `${biz.color}30`,
                              color: biz.color,
                            }}
                          >
                            {biz.name}
                          </span>
                        )}

                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                            item.priority === "URGENT" || item.priority === "HIGH"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.dueDate && (
                      <div className="text-[11px] text-slate-500 font-mono hidden sm:flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Due {formatDate(item.dueDate)}</span>
                      </div>
                    )}

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        item.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : item.status === "IN_PROGRESS"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : item.status === "REVIEW"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-slate-900 text-slate-400 border-slate-800"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Log Weekly Blueprint Metrics */}
      {showMetricModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-400" />
                <h3 className="font-bold text-white text-base">Record Weekly Performance Numbers</h3>
              </div>
              <button
                onClick={() => setShowMetricModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWeeklyMetric} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Company</label>
                  <select
                    value={metricBusinessId}
                    onChange={(e) => setMetricBusinessId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Week Identifier</label>
                  <input
                    type="text"
                    value={metricWeek}
                    onChange={(e) => setMetricWeek(e.target.value)}
                    placeholder="e.g. 2026-W42"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Blueprint Metrics Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Outreach Sent <span className="text-blue-400 font-mono">(Target 500)</span>
                  </label>
                  <input
                    type="number"
                    value={metricOutreach}
                    onChange={(e) => setMetricOutreach(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Warm Reply % <span className="text-blue-400 font-mono">(Target 10%+)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={metricReplyWarm}
                    onChange={(e) => setMetricReplyWarm(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Cold Reply % <span className="text-blue-400 font-mono">(Target 3-5%)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={metricReplyCold}
                    onChange={(e) => setMetricReplyCold(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Audits Booked <span className="text-blue-400 font-mono">(Target 5-10)</span>
                  </label>
                  <input
                    type="number"
                    value={metricAudits}
                    onChange={(e) => setMetricAudits(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Show Rate % <span className="text-blue-400 font-mono">(Target 70%+)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={metricShowRate}
                    onChange={(e) => setMetricShowRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Close Rate % <span className="text-blue-400 font-mono">(Target 25-40%)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={metricCloseRate}
                    onChange={(e) => setMetricCloseRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Time to Go-Live <span className="text-blue-400 font-mono">(&le; 30d)</span>
                  </label>
                  <input
                    type="number"
                    value={metricTimeToLive}
                    onChange={(e) => setMetricTimeToLive(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">MRR (KES)</label>
                  <input
                    type="number"
                    value={metricMrr}
                    onChange={(e) => setMetricMrr(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Client Churn <span className="text-blue-400 font-mono">(Target 0)</span>
                  </label>
                  <input
                    type="number"
                    value={metricChurn}
                    onChange={(e) => setMetricChurn(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Referrals / Client <span className="text-blue-400 font-mono">(Target 1+)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={metricReferrals}
                    onChange={(e) => setMetricReferrals(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">CAC (KES)</label>
                  <input
                    type="number"
                    value={metricCac}
                    onChange={(e) => setMetricCac(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">LTV (KES)</label>
                  <input
                    type="number"
                    value={metricLtv}
                    onChange={(e) => setMetricLtv(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Weekly Notes &amp; Wins</label>
                <textarea
                  rows={2}
                  value={metricNotes}
                  onChange={(e) => setMetricNotes(e.target.value)}
                  placeholder="e.g. Completed initial architecture review calls. Good response to lead magnet."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMetricModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Weekly Metrics</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create / Edit Client */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingClient ? "Edit Client Account" : "Add New Client"}
              </h3>
              <button
                onClick={() => setShowClientModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Company / Brand</label>
                <select
                  value={clientBusinessId}
                  onChange={(e) => setClientBusinessId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Client Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Highland Gardens Limited"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Industry</label>
                <input
                  type="text"
                  value={clientIndustry}
                  onChange={(e) => setClientIndustry(e.target.value)}
                  placeholder="e.g. Food Production (Hibiscus & Chamomile)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Scope of Work</label>
                <input
                  type="text"
                  value={clientScope}
                  onChange={(e) => setClientScope(e.target.value)}
                  placeholder="e.g. Branding and Package Designing"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Contract Type</label>
                  <select
                    value={clientContractType}
                    onChange={(e) => setClientContractType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="RETAINER">Retainer (Recurring)</option>
                    <option value="MILESTONE">Milestone Project</option>
                    <option value="ONE_TIME">One-Time Contract</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Contract Value (KES)</label>
                  <input
                    type="number"
                    value={clientContractValue}
                    onChange={(e) => setClientContractValue(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Billing Cycle</label>
                  <select
                    value={clientBillingCycle}
                    onChange={(e) => setClientBillingCycle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="PROJECT">Project Milestone</option>
                    <option value="QUARTERLY">Quarterly</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Relationship Health</label>
                  <select
                    value={clientHealth}
                    onChange={(e) => setClientHealth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="HEALTHY">Healthy (Strong alignment)</option>
                    <option value="ATTENTION">Needs Attention</option>
                    <option value="AT_RISK">At Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Key contacts, expectations, or background details..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingClient ? "Update Client" : "Save Client"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create Deliverable */}
      {showDeliverableModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Add Work Deliverable</h3>
              <button
                onClick={() => setShowDeliverableModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDeliverable} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Company</label>
                <select
                  value={delivBusinessId}
                  onChange={(e) => setDelivBusinessId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Client (Optional)</label>
                <select
                  value={delivClientId}
                  onChange={(e) => setDelivClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="">-- Internal / Company Level --</option>
                  {displayedClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Deliverable Title</label>
                <input
                  type="text"
                  required
                  value={delivTitle}
                  onChange={(e) => setDelivTitle(e.target.value)}
                  placeholder="e.g. Hibiscus Tea Packaging Print Dieline"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={delivDescription}
                  onChange={(e) => setDelivDescription(e.target.value)}
                  placeholder="Specifications, client requests, or acceptance criteria..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Priority</label>
                  <select
                    value={delivPriority}
                    onChange={(e) => setDelivPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={delivDueDate}
                    onChange={(e) => setDelivDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeliverableModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Deliverable</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteClientConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base">Delete Client Account?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-white">{deleteClientConfirm.name}</span>?
              This will also remove their associated deliverables.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteClientConfirm(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white"
              >
                {isSubmitting ? "Deleting..." : "Delete Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
