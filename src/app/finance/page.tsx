"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Calendar,
  Loader2,
  PieChart,
} from "lucide-react";
import { formatKES, formatDate } from "@/lib/utils";

interface TransactionItem {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  isRecurring: boolean;
}

interface FinanceMetrics {
  monthlyBudget: number;
  remainingBudget: number;
  budgetPercentUsed: number;
  totalIncome: number;
  totalExpense: number;
  categoryBreakdown: Record<string, number>;
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add Transaction Modal
  const [showModal, setShowModal] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [category, setCategory] = useState("Groceries");
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFinance = async () => {
    try {
      const res = await fetch("/api/finance");
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error("Failed to load finance data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, []);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc.trim(),
          amount: parseFloat(amount),
          type,
          category,
          isRecurring,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDesc("");
        setAmount("");
        setShowModal(false);
        fetchFinance();
      }
    } catch (e) {
      console.error("Failed to create transaction:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
    try {
      await fetch(`/api/finance?id=${id}`, { method: "DELETE" });
      fetchFinance();
    } catch (e) {
      fetchFinance();
    }
  };

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
            Budgeting, recurring subscriptions, and income tracking in Kenyan Shillings.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 cursor-pointer transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Log Transaction</span>
        </button>
      </div>

      {/* Top 3 Metric Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Monthly Budget</span>
            <div className="text-2xl font-bold text-white">
              {formatKES(metrics.monthlyBudget)}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${100 - metrics.budgetPercentUsed}%` }}
              />
            </div>
            <span className="text-[10px] text-emerald-400 block pt-1 font-mono">
              {formatKES(metrics.remainingBudget)} ({100 - metrics.budgetPercentUsed}% remaining)
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Total Income This Month</span>
            <div className="text-2xl font-bold text-emerald-400">
              +{formatKES(metrics.totalIncome)}
            </div>
            <span className="text-[10px] text-slate-400 block pt-1 font-mono">
              Direct deposits & milestone payouts
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Total Expenses This Month</span>
            <div className="text-2xl font-bold text-rose-400">
              -{formatKES(metrics.totalExpense)}
            </div>
            <span className="text-[10px] text-slate-400 block pt-1 font-mono">
              {transactions.filter((t) => t.amount < 0).length} expense transactions recorded
            </span>
          </div>
        </div>
      )}

      {/* Category Spending Breakdown */}
      {metrics && Object.keys(metrics.categoryBreakdown).length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <PieChart className="h-3.5 w-3.5 text-blue-400" />
            <span>Category Spending Distribution (KES)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.categoryBreakdown).map(([cat, total]) => (
              <div
                key={cat}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2"
              >
                <span className="text-slate-400">{cat}:</span>
                <span className="font-mono text-slate-200 font-semibold">{formatKES(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Feed */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 sm:p-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Recent Transactions ({transactions.length})
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Loading ledger...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No transactions recorded. Click &quot;Log Transaction&quot; or capture via `Ctrl + K`.
          </div>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((tx) => {
              const isIncome = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="p-3 sm:p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 sm:gap-4 transition-all"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div
                      className={`p-1.5 sm:p-2 rounded-lg border shrink-0 ${
                        isIncome
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-slate-900 border-slate-800 text-slate-400"
                      }`}
                    >
                      {isIncome ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-100 truncate">{tx.description}</div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        <span>{tx.category}</span>
                        <span>•</span>
                        <span>{formatDate(tx.date)}</span>
                        {tx.isRecurring && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400">Recurring</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span
                      className={`text-xs font-mono font-semibold ${
                        isIncome ? "text-emerald-400" : "text-slate-100"
                      }`}
                    >
                      {isIncome ? `+${formatKES(tx.amount)}` : `-${formatKES(Math.abs(tx.amount))}`}
                    </span>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete transaction"
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

      {/* Log Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-bold text-white">Log Financial Transaction</h2>
            <form onSubmit={handleCreateTransaction} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("EXPENSE")}
                  className={`py-2 rounded-xl font-semibold transition-all cursor-pointer ${
                    type === "EXPENSE"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-slate-950 text-slate-400 border border-slate-800"
                  }`}
                >
                  Expense (-)
                </button>
                <button
                  type="button"
                  onClick={() => setType("INCOME")}
                  className={`py-2 rounded-xl font-semibold transition-all cursor-pointer ${
                    type === "INCOME"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-950 text-slate-400 border border-slate-800"
                  }`}
                >
                  Income (+)
                </button>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Supabase Pro, Freelance payment, Coffee"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Amount (KES)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="2500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Dev Tools">Dev Tools</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Rent">Rent</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Client">Client</option>
                    <option value="Dining">Dining</option>
                    <option value="Transport">Transport</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="recurringCheck"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="recurringCheck" className="text-slate-300 cursor-pointer">
                  Recurring monthly subscription / expense
                </label>
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
                  disabled={!desc.trim() || !amount || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Logging..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
