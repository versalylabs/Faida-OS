"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Calendar,
  Loader2,
  PieChart,
  Edit3,
  CreditCard,
  Banknote,
  PiggyBank,
  Building2,
  Coins,
  X,
  Tag,
  AlertCircle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Briefcase,
  Target,
} from "lucide-react";
import { formatKES, formatDate } from "@/lib/utils";

import { offlineFetch } from "@/lib/offlineSync";
import { AccountsSection } from "@/components/finance/AccountsSection";
import { BudgetCards } from "@/components/finance/BudgetCards";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { TransferDialog } from "@/components/finance/TransferDialog";
import { TransactionFeed, type FeedKind } from "@/components/finance/TransactionFeed";
import type { FinAccount, FinCategory, FinTransaction } from "@/components/finance/shared";

type TransactionItem = FinTransaction;
type AccountItem = FinAccount;
type CategoryItem = FinCategory;

interface FinanceMetrics {
  monthlyBudget: number;
  remainingBudget: number;
  budgetPercentUsed: number;
  personalBudget: number;
  personalExpense: number;
  personalRemaining: number;
  personalPercentUsed: number;
  businessBudget: number;
  businessExpense: number;
  businessRemaining: number;
  businessPercentUsed: number;
  savingsTarget: number;
  savingsBalance: number;
  savingsPercent: number;
  totalLiquidBalance: number;
  savedThisMonth: number;
  breakdown?: { period: string; label: string; expense: Record<string, number>; income: Record<string, number> };
  netCashFlow: number;
  totalIncome: number;
  totalExpense: number;
  categoryBreakdown: Record<string, number>;
  expenseCategoryBreakdown?: Record<string, number>;
  incomeCategoryBreakdown?: Record<string, number>;
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pie / Donut Chart state
  const [chartMode, setChartMode] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Ledger filters, chart period and dialogs
  const [period, setPeriod] = useState<"month" | "last" | "30d" | "year">("month");
  const [feedKind, setFeedKind] = useState<FeedKind>("all");
  const [feedAccount, setFeedAccount] = useState("");
  const [feedQuery, setFeedQuery] = useState("");
  const [feedLimit, setFeedLimit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [txDialog, setTxDialog] = useState<{ editing: TransactionItem | null; type: "EXPENSE" | "INCOME"; accountId: string | null } | null>(null);
  const [transferDialog, setTransferDialog] = useState<{ fromId: string | null } | null>(null);

  // Edit Budgets Modal (Personal, Business, Savings Target)
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetTab, setBudgetTab] = useState<"ALL" | "PERSONAL" | "BUSINESS" | "SAVINGS">("ALL");
  const [personalBudgetInput, setPersonalBudgetInput] = useState("");
  const [businessBudgetInput, setBusinessBudgetInput] = useState("");
  const [savingsTargetInput, setSavingsTargetInput] = useState("");
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Account Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("CASH");
  const [accountBalance, setAccountBalance] = useState("");
  const [accountColor, setAccountColor] = useState("#10b981");
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Edit Account Balance Quick Modal
  const [quickBalanceAccount, setQuickBalanceAccount] = useState<AccountItem | null>(null);
  const [quickBalanceVal, setQuickBalanceVal] = useState("");
  const [isSavingQuickBalance, setIsSavingQuickBalance] = useState(false);

  // Category Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [catColor, setCatColor] = useState("#f43f5e");
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isSavingCat, setIsSavingCat] = useState(false);

  // Delete Confirmations
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState<AccountItem | null>(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<CategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFinance = async () => {
    try {
      const p = new URLSearchParams({ period, limit: String(feedLimit) });
      if (feedKind !== "all") p.set("kind", feedKind);
      if (feedAccount) p.set("accountId", feedAccount);
      if (feedQuery) p.set("q", feedQuery);
      const res = await offlineFetch("/api/finance?" + p.toString(), { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
        setHasMore(!!data.hasMore);
        setMetrics(data.metrics);
        setAccounts(data.accounts || []);
        setCategories(data.categories || []);
      }
    } catch (e) {
      console.error("Failed to load finance data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Reload when a filter or the chart period changes
  useEffect(() => {
    fetchFinance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, feedKind, feedAccount, feedQuery, feedLimit]);

  const openLog = (type: "EXPENSE" | "INCOME", accountId: string | null = null) => setTxDialog({ editing: null, type, accountId });

  const viewActivity = (acc: AccountItem) => {
    setFeedAccount(acc.id);
    setFeedLimit(100);
    setTimeout(() => document.getElementById("transactions")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const setDefaultAccount = async (acc: AccountItem) => {
    await offlineFetch("/api/finance/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: acc.id, isDefault: !acc.isDefault }),
    }).catch(() => {});
    fetchFinance();
  };

  // Compute category breakdown data for the pie / donut chart
  const breakdownData = useMemo(() => {
    const totals: Record<string, number> = {};

    // The server totals the chosen period, so the chart never depends on how many rows are listed
    const source = metrics?.breakdown ? (chartMode === "EXPENSE" ? metrics.breakdown.expense : metrics.breakdown.income) : {};
    for (const [cat, val] of Object.entries(source)) {
      if (val > 0) totals[cat] = val;
    }

    const totalSum = Object.values(totals).reduce((acc, curr) => acc + curr, 0);

    // Distinct, vibrant color palette for expense categories
    const expenseColorPalette = [
      "#6366f1", // Indigo (e.g. Loans / Debt)
      "#ec4899", // Vibrant Pink (e.g. Shopping)
      "#f59e0b", // Amber Warm Orange (e.g. Groceries)
      "#3b82f6", // Electric Blue (e.g. Tech & Subscriptions)
      "#06b6d4", // Cyan / Aquamarine (e.g. Food & Dining)
      "#8b5cf6", // Purple / Violet (e.g. Rent & Utilities)
      "#14b8a6", // Teal (e.g. Transport)
      "#f97316", // Bright Orange (e.g. Personal)
      "#10b981", // Emerald Green (e.g. Health & Wellness)
      "#f43f5e", // Rose Red (e.g. Entertainment)
      "#d946ef", // Fuchsia
      "#0ea5e9", // Sky Blue
      "#84cc16", // Lime
      "#eab308", // Golden Yellow
      "#a855f7", // Violet-Purple
      "#64748b", // Slate
    ];

    const categoryColorMap = new Map<string, string>();
    categories.forEach((c) => {
      if (c.color) categoryColorMap.set(c.name.toLowerCase().trim(), c.color);
    });

    // Well-known expense category color presets so they are intuitive and distinct
    const expenseCategoryPresetColors: Record<string, string> = {
      "loans": "#6366f1",
      "loan": "#6366f1",
      "shopping": "#ec4899",
      "groceries": "#f59e0b",
      "groceries and fruit": "#f59e0b",
      "groceries & fruit": "#f59e0b",
      "tech & subscriptions": "#3b82f6",
      "tech": "#3b82f6",
      "food & dining": "#06b6d4",
      "food": "#06b6d4",
      "dining": "#06b6d4",
      "rent & utilities": "#8b5cf6",
      "rent": "#8b5cf6",
      "transport": "#14b8a6",
      "health": "#10b981",
      "entertainment": "#f43f5e",
    };

    const usedExpenseColors = new Set<string>();

    const items = Object.entries(totals)
      .filter(([_, amt]) => amt > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt], idx) => {
        const percentage = totalSum > 0 ? (amt / totalSum) * 100 : 0;
        let color = "";

        if (chartMode === "EXPENSE") {
          const catKey = cat.toLowerCase().trim();
          const customColor = categoryColorMap.get(catKey);

          // If the category has a user-defined custom color that is not the legacy uniform red (#f43f5e)
          if (customColor && customColor.toLowerCase() !== "#f43f5e" && !usedExpenseColors.has(customColor)) {
            color = customColor;
          } else if (expenseCategoryPresetColors[catKey] && !usedExpenseColors.has(expenseCategoryPresetColors[catKey])) {
            color = expenseCategoryPresetColors[catKey];
          } else {
            // Find the next available distinct color from the palette
            const available = expenseColorPalette.find((c) => !usedExpenseColors.has(c));
            color = available || expenseColorPalette[idx % expenseColorPalette.length];
          }
          usedExpenseColors.add(color);
        } else {
          // Income overview: keep existing category colors (defaults to green #10b981)
          color = categoryColorMap.get(cat.toLowerCase().trim()) || "#10b981";
        }

        return {
          name: cat,
          amount: amt,
          percentage,
          color,
        };
      });

    return {
      items,
      totalSum,
    };
  }, [metrics, chartMode, categories]);

  const handleDeleteTransaction = async (tx: TransactionItem) => {
    try {
      await offlineFetch("/api/finance?id=" + tx.id, { method: "DELETE" });
    } catch (e) {
      console.error("Failed to delete transaction:", e);
    }
    fetchFinance();
  };

  const handleOpenBudgetModal = (tab: "ALL" | "PERSONAL" | "BUSINESS" | "SAVINGS" = "ALL") => {
    if (metrics) {
      setPersonalBudgetInput((metrics.personalBudget ?? 0).toString());
      setBusinessBudgetInput((metrics.businessBudget ?? 0).toString());
      setSavingsTargetInput((metrics.savingsTarget ?? 0).toString());
    }
    setBudgetTab(tab);
    setShowBudgetModal(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingBudget) return;

    const pLimit = parseFloat(personalBudgetInput) || 0;
    const bLimit = parseFloat(businessBudgetInput) || 0;
    const sTarget = parseFloat(savingsTargetInput) || 0;
    const totalMonthly = pLimit + bLimit;

    setIsSavingBudget(true);
    try {
      const res = await offlineFetch("/api/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalBudget: pLimit,
          businessBudget: bLimit,
          savingsTarget: sTarget,
          monthlyBudget: totalMonthly,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowBudgetModal(false);
        fetchFinance();
      }
    } catch (e) {
      console.error("Failed to update budget:", e);
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim() || isSavingAccount) return;

    setIsSavingAccount(true);
    try {
      const url = "/api/finance/accounts";
      const method = editingAccount ? "PATCH" : "POST";
      const body = editingAccount
        ? {
            id: editingAccount.id,
            name: accountName.trim(),
            type: accountType,
            balance: parseFloat(accountBalance) || 0,
            color: accountColor,
          }
        : {
            name: accountName.trim(),
            type: accountType,
            balance: parseFloat(accountBalance) || 0,
            color: accountColor,
          };

      const res = await offlineFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowAccountModal(false);
        setEditingAccount(null);
        setAccountName("");
        setAccountBalance("");
        fetchFinance();
      }
    } catch (e) {
      console.error("Failed to save account:", e);
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleSaveQuickBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBalanceAccount || isSavingQuickBalance) return;

    const newBal = parseFloat(quickBalanceVal) || 0;
    setIsSavingQuickBalance(true);
    try {
      const res = await offlineFetch("/api/finance/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quickBalanceAccount.id,
          balance: newBal,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(accounts.map((a) => (a.id === quickBalanceAccount.id ? { ...a, balance: newBal } : a)));
        setQuickBalanceAccount(null);
        setQuickBalanceVal("");
        fetchFinance();
      }
    } catch (e) {
      console.error("Failed to update account balance:", e);
    } finally {
      setIsSavingQuickBalance(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountConfirm || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await offlineFetch(`/api/finance/accounts?id=${deleteAccountConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteAccountConfirm(null);
        fetchFinance();
      }
    } catch (e) {
      console.error("Failed to delete account:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || isSavingCat) return;

    setIsSavingCat(true);
    try {
      const url = "/api/finance/categories";
      const method = editingCategory ? "PATCH" : "POST";
      const body = editingCategory
        ? {
            id: editingCategory.id,
            name: catName.trim(),
            type: catType,
            color: catColor,
          }
        : {
            name: catName.trim(),
            type: catType,
            color: catColor,
          };

      const res = await offlineFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowCategoryModal(false);
        setEditingCategory(null);
        setCatName("");
        fetchFinance();
      }
    } catch (e) {
      console.error("Failed to save category:", e);
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryConfirm || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await offlineFetch(`/api/finance/categories?id=${deleteCategoryConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteCategoryConfirm(null);
        fetchFinance();
      }
    } catch (e) {
      console.error("Failed to delete category:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "CARD":
        return <CreditCard className="h-4 w-4" />;
      case "CASH":
        return <Banknote className="h-4 w-4" />;
      case "SAVINGS":
        return <PiggyBank className="h-4 w-4" />;
      case "BANK":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Coins className="h-4 w-4" />;
    }
  };

  const totalAccountBalance = accounts.reduce((acc, a) => acc + a.balance, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
            <Wallet className="h-3.5 w-3.5" />
            Personal Finance (KES)
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Financial Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Budgeting, accounts, cash reserves, and income tracking in Kenyan Shillings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <Tag className="h-3.5 w-3.5 text-blue-400" />
            <span>Categories</span>
          </button>
          <button
            onClick={() => openLog("EXPENSE")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/10 cursor-pointer transition-all shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Transaction</span>
          </button>
        </div>
      </div>

      {/* ACCOUNTS FIRST: what you hold right now */}
      <AccountsSection
        accounts={accounts}
        loading={isLoading}
        activeAccountId={feedAccount || null}
        onAdd={() => {
          setEditingAccount(null);
          setAccountName("");
          setAccountType("CARD");
          setAccountBalance("0");
          setShowAccountModal(true);
        }}
        onEdit={(acc) => {
          setEditingAccount(acc);
          setAccountName(acc.name);
          setAccountType(acc.type);
          setAccountBalance(acc.balance.toString());
          setAccountColor(acc.color || "#10b981");
          setShowAccountModal(true);
        }}
        onDelete={(acc) => setDeleteAccountConfirm(acc)}
        onAdjust={(acc) => {
          setQuickBalanceAccount(acc);
          setQuickBalanceVal(acc.balance.toString());
        }}
        onLog={(type, accountId) => openLog(type, accountId)}
        onTransfer={(fromId) => setTransferDialog({ fromId })}
        onSetDefault={setDefaultAccount}
        onViewActivity={viewActivity}
      />

      {/* Budgets, savings and this month's cash flow */}
      {metrics && <BudgetCards metrics={metrics} onEdit={handleOpenBudgetModal} />}

      {/* Interactive Category & Cash Flow Pie Chart Overview */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
        {/* Header & Toggle Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <PieChart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Category Financial Overview
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    chartMode === "EXPENSE"
                      ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {chartMode === "EXPENSE" ? "Expenses" : "Income"}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {metrics?.breakdown?.label ?? "This month"}: where your money came from and went. Transfers are not counted.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              aria-label="Chart period"
            >
              <option value="month">This month</option>
              <option value="last">Last month</option>
              <option value="30d">Last 30 days</option>
              <option value="year">This year</option>
            </select>
          {/* Segmented Controls for Expense vs Income */}
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setChartMode("EXPENSE");
                setHoveredCategory(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                chartMode === "EXPENSE"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
              <span>Expense Overview</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChartMode("INCOME");
                setHoveredCategory(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                chartMode === "INCOME"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span>Income Overview</span>
            </button>
          </div>
          </div>
        </div>

        {/* Chart + Category Details Content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left Column: Donut Chart */}
          <div className="md:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-60 h-60 flex items-center justify-center">
              {breakdownData.items.length === 0 ? (
                /* Empty ring placeholder */
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 240 240">
                  <circle
                    cx="120"
                    cy="120"
                    r="75"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="20"
                    strokeDasharray="4 4"
                  />
                </svg>
              ) : (
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 240 240">
                  {/* Background base circle */}
                  <circle
                    cx="120"
                    cy="120"
                    r="75"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="20"
                  />
                  {/* Slices */}
                  {(() => {
                    const radius = 75;
                    const circumference = 2 * Math.PI * radius;
                    let accumulatedPercent = 0;
                    const isSingle = breakdownData.items.length === 1;

                    return breakdownData.items.map((item) => {
                      const isHovered = hoveredCategory === item.name;
                      const strokeDash = (item.percentage / 100) * circumference;
                      const arcLength = isSingle ? circumference : Math.max(0.5, strokeDash - 2);
                      const strokeDasharray = `${arcLength} ${circumference - arcLength}`;
                      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                      accumulatedPercent += item.percentage;

                      return (
                        <circle
                          key={item.name}
                          cx="120"
                          cy="120"
                          r={radius}
                          fill="none"
                          stroke={item.color}
                          strokeWidth={isHovered ? 26 : 20}
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-300 cursor-pointer"
                          style={{
                            opacity: hoveredCategory && !isHovered ? 0.35 : 1,
                          }}
                          onMouseEnter={() => setHoveredCategory(item.name)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        />
                      );
                    });
                  })()}
                </svg>
              )}

              {/* Center Text (HTML overlay for flawless text wrapping & styling) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                {(() => {
                  const hoveredItem = hoveredCategory
                    ? breakdownData.items.find((i) => i.name === hoveredCategory)
                    : null;

                  if (hoveredItem) {
                    return (
                      <div className="space-y-1">
                        <div
                          className="text-[11px] font-bold uppercase tracking-wider truncate max-w-[140px]"
                          style={{ color: hoveredItem.color }}
                        >
                          {hoveredItem.name}
                        </div>
                        <div className="text-base sm:text-lg font-bold font-mono text-white">
                          {formatKES(hoveredItem.amount)}
                        </div>
                        <div
                          className="inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${hoveredItem.color}20`,
                            color: hoveredItem.color,
                          }}
                        >
                          {hoveredItem.percentage.toFixed(1)}% of total
                        </div>
                      </div>
                    );
                  }

                  if (breakdownData.items.length === 0) {
                    return (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          No Data
                        </span>
                        <div className="text-xs text-slate-400 font-mono">
                          KES 0
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {chartMode === "EXPENSE" ? "Total Spending" : "Total Earnings"}
                      </span>
                      <div className="text-base sm:text-lg font-bold font-mono text-white tracking-tight">
                        {formatKES(breakdownData.totalSum)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {breakdownData.items.length}{" "}
                        {breakdownData.items.length === 1 ? "category" : "categories"}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 text-center">
              Hover over any slice or category row for details
            </p>
          </div>

          {/* Right Column: Category Breakdown List */}
          <div className="md:col-span-7 space-y-2">
            {breakdownData.items.length === 0 ? (
              <div className="py-10 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 p-6 space-y-2">
                <div className="text-xs font-medium text-slate-400">
                  No {chartMode === "EXPENSE" ? "expenses" : "income"} in this period
                </div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Log your first {chartMode.toLowerCase()} transaction using the &quot;Log Transaction&quot; button above to see your breakdown visualized.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {breakdownData.items.map((item) => {
                  const isHovered = hoveredCategory === item.name;
                  return (
                    <div
                      key={item.name}
                      onMouseEnter={() => setHoveredCategory(item.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                        isHovered
                          ? "bg-slate-800/90 border-slate-600 shadow-md ring-1 ring-slate-600 scale-[1.01]"
                          : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-semibold text-slate-200 truncate">
                            {item.name}
                          </span>
                          <span
                            className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border"
                            style={{
                              backgroundColor: `${item.color}15`,
                              borderColor: `${item.color}30`,
                              color: item.color,
                            }}
                          >
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="font-mono font-bold text-slate-100 text-right shrink-0">
                          {formatKES(item.amount)}
                        </div>
                      </div>

                      {/* Relative progress bar */}
                      <div className="mt-2 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Feed */}
      <TransactionFeed
        transactions={transactions}
        accounts={accounts}
        loading={isLoading}
        kind={feedKind}
        setKind={(k) => {
          setFeedKind(k);
          setFeedLimit(100);
        }}
        accountId={feedAccount}
        setAccountId={(id) => {
          setFeedAccount(id);
          setFeedLimit(100);
        }}
        query={feedQuery}
        setQuery={(q) => {
          setFeedQuery(q);
          setFeedLimit(100);
        }}
        hasMore={hasMore}
        onLoadMore={() => setFeedLimit((n) => n + 100)}
        onEdit={(tx) => setTxDialog({ editing: tx, type: tx.amount >= 0 ? "INCOME" : "EXPENSE", accountId: tx.accountId ?? null })}
        onDelete={handleDeleteTransaction}
      />

      {/* EDIT BUDGETS MODAL */}
      {showBudgetModal && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-emerald-400" />
                  Configure Budgets & Financial Goals
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Set separate limits for personal living, business ops, and savings.
                </p>
              </div>
              <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-3.5 text-xs">
              {/* 1. Personal Budget */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-semibold flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-emerald-400" />
                    Personal Monthly Budget (KES)
                  </label>
                  <span className="text-[10px] text-slate-400">Living & Lifestyle</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={personalBudgetInput}
                  onChange={(e) => setPersonalBudgetInput(e.target.value)}
                  placeholder="e.g. 120000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                  autoFocus={budgetTab === "PERSONAL" || budgetTab === "ALL"}
                />
                <p className="text-[10px] text-slate-400">
                  Groceries, food & dining, rent, shopping, utilities, transport, and health.
                </p>
              </div>

              {/* 2. Business Budget */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-semibold flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-blue-400" />
                    Business Operations Budget (KES)
                  </label>
                  <span className="text-[10px] text-slate-400">Versaly & Straten</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={businessBudgetInput}
                  onChange={(e) => setBusinessBudgetInput(e.target.value)}
                  placeholder="e.g. 80000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-sm"
                  autoFocus={budgetTab === "BUSINESS"}
                />
                <p className="text-[10px] text-slate-400">
                  Software tools, hosting/cloud, client marketing/ads, subscriptions, contractors.
                </p>
              </div>

              {/* 3. Savings Target */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-semibold flex items-center gap-1.5">
                    <PiggyBank className="h-3.5 w-3.5 text-purple-400" />
                    Monthly Savings Target (KES)
                  </label>
                  <span className="text-[10px] text-purple-300">Reserve Allocation</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={savingsTargetInput}
                  onChange={(e) => setSavingsTargetInput(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-sm"
                  autoFocus={budgetTab === "SAVINGS"}
                />
                <p className="text-[10px] text-slate-400">
                  Monthly accumulation target tracked against your Savings accounts.
                </p>
              </div>

              {/* Total Summary */}
              <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Combined Monthly Spending Limit:</span>
                <span className="font-mono font-bold text-white">
                  {formatKES((parseFloat(personalBudgetInput) || 0) + (parseFloat(businessBudgetInput) || 0))}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBudget}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  {isSavingBudget ? "Saving..." : "Save Budgets"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT ACCOUNT MODAL */}
      {showAccountModal && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-400" />
                {editingAccount ? "Edit Account" : "Add New Account"}
              </h2>
              <button onClick={() => setShowAccountModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. Card, Cash, Savings, M-Pesa, NCBA"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CARD">Card</option>
                    <option value="CASH">Cash</option>
                    <option value="SAVINGS">Savings</option>
                    <option value="BANK">Bank Account</option>
                    <option value="INVESTMENT">Investment</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Current Balance (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Badge Color</label>
                <div className="flex items-center gap-2">
                  {["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#6366f1"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccountColor(c)}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${
                        accountColor === c ? "scale-110 border-white" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSavingAccount ? "Saving..." : editingAccount ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK BALANCE EDIT MODAL */}
      {quickBalanceAccount && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2 className="text-xs font-bold text-white uppercase">
                Set {quickBalanceAccount.name} Balance
              </h2>
              <button onClick={() => setQuickBalanceAccount(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickBalance} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Actual balance right now (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  value={quickBalanceVal}
                  onChange={(e) => setQuickBalanceVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickBalanceAccount(null)}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickBalance}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSavingQuickBalance ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORIES MANAGEMENT MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-400" />
                Manage Income & Expense Categories
              </h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleSaveCategory} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
              <div className="font-semibold text-slate-200">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Category Name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  required
                />
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="EXPENSE">Expense Category</option>
                  <option value="INCOME">Income Category</option>
                </select>
                <button
                  type="submit"
                  disabled={!catName.trim() || isSavingCat}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSavingCat ? "Saving..." : editingCategory ? "Update" : "Add Category"}
                </button>
              </div>
              {editingCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setCatName("");
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200 block"
                >
                  Cancel editing
                </button>
              )}
            </form>

            {/* Existing Categories Lists */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block mb-1.5">
                  Expense Categories ({categories.filter((c) => c.type === "EXPENSE").length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {categories
                    .filter((c) => c.type === "EXPENSE")
                    .map((c) => (
                      <div
                        key={c.id}
                        className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 group"
                      >
                        <span className="text-slate-300">{c.name}</span>
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingCategory(c);
                              setCatName(c.name);
                              setCatType("EXPENSE");
                            }}
                            className="text-slate-400 hover:text-blue-400"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setDeleteCategoryConfirm(c)}
                            className="text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1.5">
                  Income Categories ({categories.filter((c) => c.type === "INCOME").length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {categories
                    .filter((c) => c.type === "INCOME")
                    .map((c) => (
                      <div
                        key={c.id}
                        className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 group"
                      >
                        <span className="text-slate-300">{c.name}</span>
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingCategory(c);
                              setCatName(c.name);
                              setCatType("INCOME");
                            }}
                            className="text-slate-400 hover:text-blue-400"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setDeleteCategoryConfirm(c)}
                            className="text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT CONFIRMATION */}
      {deleteAccountConfirm && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-white">Delete Account?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteAccountConfirm.name}&quot;</strong> with balance of {formatKES(deleteAccountConfirm.balance)}?
            </p>
            <p className="text-[11px] text-slate-400">
              Its past transactions stay in your history but are no longer linked to an account, and the {formatKES(deleteAccountConfirm.balance)} drops out of your total. Move the money to another account first if it still exists.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteAccountConfirm(null)}
                className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY CONFIRMATION */}
      {deleteCategoryConfirm && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-white">Delete Category?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete category <strong className="text-white">&quot;{deleteCategoryConfirm.name}&quot;</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteCategoryConfirm(null)}
                className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCategory}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {txDialog && (
        <TransactionDialog
          key={txDialog.editing?.id ?? "new-" + txDialog.type + (txDialog.accountId ?? "")}
          accounts={accounts}
          categories={categories}
          editing={txDialog.editing}
          defaults={{ type: txDialog.type, accountId: txDialog.accountId }}
          onClose={() => setTxDialog(null)}
          onSaved={fetchFinance}
          onManageCategories={() => {
            setTxDialog(null);
            setShowCategoryModal(true);
          }}
        />
      )}
      {transferDialog && <TransferDialog accounts={accounts} defaultFromId={transferDialog.fromId} onClose={() => setTransferDialog(null)} onSaved={fetchFinance} />}
    </div>
  );
}
