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
  X,
  Edit3,
  Settings2,
  Check,
  FolderPlus,
  Sparkles,
  Save,
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

interface ShoppingCategory {
  id: string;
  name: string;
  color?: string | null;
  itemCount?: number;
}

const PRESET_COLORS = [
  "#10b981", // Emerald / Groceries
  "#f59e0b", // Amber / Cereals
  "#3b82f6", // Blue / Tech
  "#ec4899", // Pink / Personal Care
  "#8b5cf6", // Purple / Household
  "#06b6d4", // Cyan / Supplies
  "#f43f5e", // Rose / Butchery
  "#14b8a6", // Teal / Pharmacy
  "#64748b", // Slate / General
];

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [categories, setCategories] = useState<ShoppingCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // New Item Form State
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("Groceries");
  const [store, setStore] = useState("Supermarket");
  const [price, setPrice] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category Management Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#10b981");
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);
  const [isSavingCat, setIsSavingCat] = useState(false);

  // Edit Shopping Item Modal State
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQuantity, setEditItemQuantity] = useState("1");
  const [editItemCategory, setEditItemCategory] = useState("Groceries");
  const [editItemStore, setEditItemStore] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/shopping", { cache: "no-store" });
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

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/shopping/categories", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.categories) {
        setCategories(data.categories);
        if (!category && data.categories.length > 0) {
          setCategory(data.categories[0].name);
        }
      }
    } catch (e) {
      console.error("Failed to load shopping categories:", e);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
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
      fetchCategories();
    } catch (e) {
      fetchItems();
    }
  };

  // Add Item
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
          category: category || "Groceries",
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
        fetchCategories();
      }
    } catch (e) {
      console.error("Failed to add shopping item:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Item Modal
  const openEditItemModal = (item: ShoppingItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemQuantity(item.quantity || "1");
    setEditItemCategory(item.category || "Groceries");
    setEditItemStore(item.preferredStore || "");
    setEditItemPrice(item.estimatedPrice ? String(item.estimatedPrice) : "");
  };

  // Save Edited Item
  const handleSaveItemEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editItemName.trim() || isSavingItem) return;

    setIsSavingItem(true);
    try {
      const res = await fetch("/api/shopping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          name: editItemName.trim(),
          quantity: editItemQuantity,
          category: editItemCategory,
          preferredStore: editItemStore,
          estimatedPrice: editItemPrice ? parseFloat(editItemPrice) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingItem(null);
        fetchItems();
        fetchCategories();
      } else {
        alert(data.error || "Failed to update item");
      }
    } catch (e) {
      console.error("Failed to update item:", e);
    } finally {
      setIsSavingItem(false);
    }
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || isAddingCat) return;

    setIsAddingCat(true);
    try {
      const res = await fetch("/api/shopping/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCatName.trim(),
          color: newCatColor,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewCatName("");
        fetchCategories();
      } else {
        alert(data.error || "Failed to add category");
      }
    } catch (e) {
      console.error("Error adding category:", e);
    } finally {
      setIsAddingCat(false);
    }
  };

  // Save Edit Category
  const handleSaveCategoryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim() || isSavingCat) return;

    setIsSavingCat(true);
    try {
      const res = await fetch("/api/shopping/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCategory.id,
          name: editingCategory.name.trim(),
          color: editingCategory.color,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingCategory(null);
        fetchCategories();
        fetchItems();
      } else {
        alert(data.error || "Failed to update category");
      }
    } catch (e) {
      console.error("Error updating category:", e);
    } finally {
      setIsSavingCat(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete category "${name}"? Any items in this category will be moved to Groceries.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/shopping/categories?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (selectedCategory === name) {
          setSelectedCategory("ALL");
        }
        fetchCategories();
        fetchItems();
      } else {
        alert(data.error || "Failed to delete category");
      }
    } catch (e) {
      console.error("Error deleting category:", e);
    }
  };

  // Filtering by category
  const filteredItems = items.filter((i) => {
    if (selectedCategory === "ALL") return true;
    return i.category?.toLowerCase() === selectedCategory.toLowerCase();
  });

  const pendingItems = filteredItems.filter((i) => !i.isChecked);
  const completedItems = filteredItems.filter((i) => i.isChecked);

  const getCategoryColor = (catName?: string | null) => {
    const found = categories.find(
      (c) => c.name.toLowerCase() === (catName || "").toLowerCase()
    );
    return found?.color || "#10b981";
  };

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
            Organize supplies and groceries by custom categories (cereals, groceries, tech, etc.).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Manage Categories Button */}
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-all shrink-0"
            title="Add, edit, or delete categories"
          >
            <Tag className="h-3.5 w-3.5 text-emerald-400" />
            <span>Categories</span>
          </button>

          {/* Add Item Button */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            selectedCategory === "ALL"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <span>All Items</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/30">
            {items.length}
          </span>
        </button>

        {categories.map((cat) => {
          const count = items.filter(
            (i) => i.category?.toLowerCase() === cat.name.toLowerCase()
          ).length;
          const isSelected =
            selectedCategory.toLowerCase() === cat.name.toLowerCase();

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? "bg-slate-800 text-white border border-slate-600 shadow-md"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color || "#10b981" }}
              />
              <span>{cat.name}</span>
              {count > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800/80 text-slate-300">
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => setShowCategoryModal(true)}
          className="px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-300 border border-dashed border-slate-800 hover:border-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
          title="Add new category"
        >
          <Plus className="h-3 w-3" />
          <span>New Category</span>
        </button>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-700 space-y-3 animate-in fade-in text-xs"
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-200">Add Item to Shopping List</div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Item name (e.g. Oatmeal, Cornflakes, Milk, AA Batteries)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <input
              type="text"
              placeholder="Quantity (e.g. 1kg, 2 packs, 500g)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                {categories.length === 0 && (
                  <option value="Groceries">Groceries</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Store (Optional)</label>
              <input
                type="text"
                placeholder="Store (e.g. Supermarket, Local Market)"
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Price in KES (Optional)</label>
              <input
                type="number"
                placeholder="Estimated KES"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
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
            <span>
              To Buy ({pendingItems.length})
              {selectedCategory !== "ALL" && (
                <span className="text-emerald-400 font-normal ml-1">
                  in &quot;{selectedCategory}&quot;
                </span>
              )}
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <span>Loading shopping list...</span>
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 text-center">
              {selectedCategory !== "ALL"
                ? `No pending items in category "${selectedCategory}".`
                : "All items bought! Click \"Add Item\" above to queue up supplies."}
            </div>
          ) : (
            <div className="space-y-2">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => handleToggleCheck(item)}
                      className="text-slate-500 hover:text-emerald-400 cursor-pointer transition-colors shrink-0"
                    >
                      <Circle className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-100 flex items-center gap-2 flex-wrap">
                        <span
                          onClick={() => openEditItemModal(item)}
                          className="cursor-pointer hover:text-blue-400 transition-colors"
                        >
                          {item.name}
                        </span>
                        {item.quantity && item.quantity !== "1" && (
                          <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.2 rounded bg-slate-800">
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5 flex-wrap">
                        {item.category && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: getCategoryColor(item.category) }}
                            />
                            {item.category}
                          </span>
                        )}
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

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditItemModal(item)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                      title="Edit item"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                    {item.category && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        ({item.category})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditItemModal(item)}
                      className="p-1 text-slate-500 hover:text-blue-400"
                      title="Edit item"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-600 hover:text-rose-400 p-1"
                      title="Delete item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MANAGE CATEGORIES MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Manage Shopping Categories</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Add New Category Form */}
              <form
                onSubmit={handleAddCategory}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <FolderPlus className="h-3.5 w-3.5 text-blue-400" />
                  <span>Add New Category</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Cereals, Groceries, Bakery, Beverages"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!newCatName.trim() || isAddingCat}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isAddingCat ? "Adding..." : "+ Add"}
                  </button>
                </div>

                {/* Color presets */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Color:</span>
                  <div className="flex items-center gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className={`h-5 w-5 rounded-full border transition-all ${
                          newCatColor === c
                            ? "ring-2 ring-white scale-110"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </form>

              {/* Categories List */}
              <div className="space-y-2">
                <div className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                  Existing Categories ({categories.length})
                </div>

                {categories.length === 0 ? (
                  <div className="text-slate-500 text-center py-4 italic">
                    No categories found.
                  </div>
                ) : (
                  categories.map((cat) => {
                    const isEditing = editingCategory?.id === cat.id;

                    if (isEditing) {
                      return (
                        <form
                          key={cat.id}
                          onSubmit={handleSaveCategoryEdit}
                          className="p-3 rounded-xl bg-slate-950 border border-blue-500/50 space-y-2.5 animate-in fade-in"
                        >
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingCategory.name}
                              onChange={(e) =>
                                setEditingCategory({
                                  ...editingCategory,
                                  name: e.target.value,
                                })
                              }
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={!editingCategory.name.trim() || isSavingCat}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {PRESET_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setEditingCategory({
                                    ...editingCategory,
                                    color: c,
                                  })
                                }
                                className={`h-4 w-4 rounded-full border transition-all ${
                                  editingCategory.color === c
                                    ? "ring-2 ring-white scale-110"
                                    : "border-transparent opacity-75"
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || "#10b981" }}
                          />
                          <span className="font-semibold text-slate-200">{cat.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({cat.itemCount || 0} items)
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingCategory({
                                id: cat.id,
                                name: cat.name,
                                color: cat.color || "#10b981",
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                            title="Edit category"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                            title="Delete category"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SHOPPING ITEM MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-400" />
                <h2 className="text-base font-bold text-white">Edit Shopping Item</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItemEdit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">Item Name</label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Quantity</label>
                  <input
                    type="text"
                    value={editItemQuantity}
                    onChange={(e) => setEditItemQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Category</label>
                  <select
                    value={editItemCategory}
                    onChange={(e) => setEditItemCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {categories.length === 0 && (
                      <option value="Groceries">Groceries</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Store</label>
                  <input
                    type="text"
                    value={editItemStore}
                    onChange={(e) => setEditItemStore(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Price in KES</label>
                  <input
                    type="number"
                    value={editItemPrice}
                    onChange={(e) => setEditItemPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editItemName.trim() || isSavingItem}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingItem ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
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
