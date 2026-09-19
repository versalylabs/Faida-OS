"use client";

import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Store,
  Tag,
  Loader2,
  Check,
} from "lucide-react";
import { formatKES } from "@/lib/utils";

interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string | null;
  category?: string | null;
  preferredStore?: string | null;
  estimatedPrice?: number | null;
  isChecked: boolean;
}

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Item Form
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("Groceries");
  const [store, setStore] = useState("Supermarket");
  const [price, setPrice] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/shopping");
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (e) {
      console.error("Failed to load shopping list:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleToggleCheck = async (item: ShoppingItem) => {
    const nextChecked = !item.isChecked;
    setItems(
      items.map((i) => (i.id === item.id ? { ...i, isChecked: nextChecked } : i))
    );

    try {
      await fetch("/api/shopping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isChecked: nextChecked }),
      });
    } catch (e) {
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    setItems(items.filter((i) => i.id !== id));
    try {
      await fetch(`/api/shopping?id=${id}`, { method: "DELETE" });
    } catch (e) {
      fetchItems();
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          quantity,
          category,
          preferredStore: store,
          estimatedPrice: price ? parseFloat(price) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setName("");
        setPrice("");
        setShowAddForm(false);
        fetchItems();
      }
    } catch (e) {
      console.error("Failed to add shopping item:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingItems = items.filter((i) => !i.isChecked);
  const completedItems = items.filter((i) => i.isChecked);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
            <ShoppingCart className="h-3.5 w-3.5" />
            Smart Inventory
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Smart Shopping List
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-populated from Universal Capture or entered directly, organized by store.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-700 space-y-3 animate-in fade-in text-xs"
        >
          <div className="font-semibold text-slate-200">Add Item to Shopping List</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Item name (e.g. AA Batteries, HDMI cable)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <input
              type="text"
              placeholder="Quantity (e.g. 1, 500g, 2 packs)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none"
            >
              <option value="Groceries">Groceries</option>
              <option value="Personal Care">Personal Care</option>
              <option value="Tech">Tech / Electronics</option>
              <option value="Household">Household</option>
              <option value="Supplies">Supplies</option>
            </select>

            <input
              type="text"
              placeholder="Preferred store (e.g. Supermarket, Pharmacy)"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />

            <input
              type="number"
              placeholder="Estimated Price in KES (Optional)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              Add Item
            </button>
          </div>
        </form>
      )}

      {/* Items List */}
      <div className="space-y-6">
        {/* Pending Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>To Buy ({pendingItems.length})</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <span>Loading shopping list...</span>
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 text-center">
              All items bought! Use `Ctrl + K` or click &quot;Add Item&quot; to queue up supplies.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleCheck(item)}
                      className="text-slate-500 hover:text-emerald-400 cursor-pointer transition-colors"
                    >
                      <Circle className="h-4 w-4" />
                    </button>
                    <div>
                      <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.quantity && item.quantity !== "1" && (
                          <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.2 rounded bg-slate-800">
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span>{item.category}</span>
                        {item.preferredStore && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400 flex items-center gap-1">
                              <Store className="h-2.5 w-2.5" />
                              {item.preferredStore}
                            </span>
                          </>
                        )}
                        {item.estimatedPrice && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">
                              ~{formatKES(item.estimatedPrice)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-800/80">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Purchased ({completedItems.length})
            </div>
            <div className="space-y-2 opacity-60">
              {completedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleCheck(item)}
                      className="text-emerald-400 cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <span className="line-through text-slate-400">{item.name}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-600 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
