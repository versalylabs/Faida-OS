"use client";

import { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  Sunrise,
  Sun,
  Moon,
  Clock,
  Flame,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Calendar,
  X,
  Loader2,
  ChefHat,
  Tag,
  Info,
  Check,
  ArrowRight,
  Settings2,
} from "lucide-react";
import { offlineFetch, cacheOfflineData, getCachedOfflineData } from "@/lib/offlineSync";

interface MealIdeaItem {
  id: string;
  mealType: string;
  title: string;
  description?: string | null;
  calories?: number | null;
  prepTime?: number | null;
  tags?: string | null;
}

interface MealItem {
  id: string;
  dayOfWeek: string;
  mealType: "BREAKFAST" | "LUNCH" | "SUPPER" | string;
  title: string;
  description?: string | null;
  calories?: number | null;
  prepTime?: number | null;
  tags?: string | null;
  isCompleted: boolean;
}

const DAYS_OF_WEEK = [
  { key: "MONDAY", label: "Monday", short: "Mon" },
  { key: "TUESDAY", label: "Tuesday", short: "Tue" },
  { key: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { key: "THURSDAY", label: "Thursday", short: "Thu" },
  { key: "FRIDAY", label: "Friday", short: "Fri" },
  { key: "SATURDAY", label: "Saturday", short: "Sat" },
  { key: "SUNDAY", label: "Sunday", short: "Sun" },
];

const MEAL_TYPES = [
  {
    key: "BREAKFAST",
    label: "Breakfast",
    timeLabel: "Morning Fuel",
    icon: Sunrise,
    color: "from-amber-500/20 to-orange-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
  {
    key: "LUNCH",
    label: "Lunch",
    timeLabel: "Midday Recharge",
    icon: Sun,
    color: "from-emerald-500/20 to-teal-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  {
    key: "SUPPER",
    label: "Supper",
    timeLabel: "Evening Feast",
    icon: Moon,
    color: "from-indigo-500/20 to-purple-500/10",
    border: "border-indigo-500/30",
    text: "text-indigo-400",
    badgeBg: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  },
];

const PRESET_IDEAS = [
  {
    type: "BREAKFAST",
    title: "Spanish Omelette & Spiced Chai",
    desc: "Whisked eggs with onions, tomatoes, coriander, served with toasted bread.",
    prep: 15,
    cal: 420,
    tags: "High Protein, Quick",
  },
  {
    type: "BREAKFAST",
    title: "Oatmeal with Bananas & Honey",
    desc: "Rolled oats simmered in milk, topped with sliced fruit and chia seeds.",
    prep: 10,
    cal: 380,
    tags: "Fiber Rich, Energizing",
  },
  {
    type: "LUNCH",
    title: "Chicken Curry with Basmati Rice",
    desc: "Spiced chicken breast stewed in tomato gravy with steamed greens.",
    prep: 30,
    cal: 620,
    tags: "High Protein, Balanced",
  },
  {
    type: "LUNCH",
    title: "Beef Stir-Fry Noodles with Veggies",
    desc: "Egg noodles tossed with lean strips of beef, soy sauce, and bell peppers.",
    prep: 25,
    cal: 580,
    tags: "Fast, Savory",
  },
  {
    type: "SUPPER",
    title: "Ugali with Sukuma Wiki & Beef",
    desc: "Hot cornmeal ugali served with sautéed greens and tender braised beef.",
    prep: 35,
    cal: 680,
    tags: "Kenyan Classic, Filling",
  },
  {
    type: "SUPPER",
    title: "Chapati with Ndengu Stew & Avocado",
    desc: "Flaky handmade chapati paired with green grams stew and ripe avocado.",
    prep: 40,
    cal: 640,
    tags: "Plant Protein, Comfort",
  },
  {
    type: "SUPPER",
    title: "Ugali with Fried Tilapia & Kachumbari",
    desc: "Crispy whole tilapia paired with fresh tomato-onion-coriander kachumbari.",
    prep: 35,
    cal: 720,
    tags: "Lakeside Classic, High Protein",
  },
];

export default function MenuPage() {
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [groupedByDay, setGroupedByDay] = useState<
    Record<string, Record<string, MealItem | null>>
  >({});
  const [currentDay, setCurrentDay] = useState<string>("MONDAY");
  const [selectedDay, setSelectedDay] = useState<string>("ALL");
  const [selectedMealTypeFilter, setSelectedMealTypeFilter] =
    useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [modalDay, setModalDay] = useState<string>("MONDAY");
  const [modalMealType, setModalMealType] = useState<string>("BREAKFAST");
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalDescription, setModalDescription] = useState<string>("");
  const [modalCalories, setModalCalories] = useState<string>("");
  const [modalPrepTime, setModalPrepTime] = useState<string>("");
  const [modalTags, setModalTags] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Ideas Manager State
  const [mealIdeas, setMealIdeas] = useState<MealIdeaItem[]>([]);
  const [showIdeasManager, setShowIdeasManager] = useState(false);
  const [editingIdea, setEditingIdea] = useState<MealIdeaItem | null>(null);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaMealType, setIdeaMealType] = useState("ANY");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [ideaCalories, setIdeaCalories] = useState("");
  const [ideaPrepTime, setIdeaPrepTime] = useState("");
  const [ideaTags, setIdeaTags] = useState("");
  const [isSavingIdea, setIsSavingIdea] = useState(false);
  const [deleteConfirmIdea, setDeleteConfirmIdea] = useState<MealIdeaItem | null>(null);

  // Delete & Reset Confirmations
  const [deleteConfirmMeal, setDeleteConfirmMeal] = useState<MealItem | null>(
    null
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fetchIdeas = async () => {
    try {
      const res = await offlineFetch("/api/menu/ideas", { cacheKey: "meal_ideas" });
      const data = await res.json();
      if (data.success && data.ideas) {
        setMealIdeas(data.ideas);
        cacheOfflineData("meal_ideas", data);
      }
    } catch (e) {
      console.error("Failed to load meal ideas:", e);
      const cached = getCachedOfflineData<any>("meal_ideas");
      if (cached?.ideas) {
        setMealIdeas(cached.ideas);
      }
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await offlineFetch("/api/menu", { cache: "no-store", cacheKey: "weekly_menu" });
      const data = await res.json();
      if (data.success) {
        setMeals(data.meals || []);
        setGroupedByDay(data.groupedByDay || {});
        if (data.currentDay) {
          setCurrentDay(data.currentDay);
        }
        cacheOfflineData("weekly_menu", data);
      }
    } catch (e) {
      console.error("Failed to load menu data:", e);
      const cached = getCachedOfflineData<any>("weekly_menu");
      if (cached) {
        setMeals(cached.meals || []);
        setGroupedByDay(cached.groupedByDay || {});
        if (cached.currentDay) setCurrentDay(cached.currentDay);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchIdeas();

    const handleSyncRefresh = () => {
      fetchMenu();
      fetchIdeas();
    };
    window.addEventListener("faida-sync-completed", handleSyncRefresh);
    return () => window.removeEventListener("faida-sync-completed", handleSyncRefresh);
  }, []);

  const openAddModal = (day: string, type: string) => {
    setEditingMealId(null);
    setModalDay(day);
    setModalMealType(type);
    setModalTitle("");
    setModalDescription("");
    setModalCalories("");
    setModalPrepTime("");
    setModalTags("");
    setShowModal(true);
  };

  const openEditModal = (meal: MealItem) => {
    setEditingMealId(meal.id);
    setModalDay(meal.dayOfWeek);
    setModalMealType(meal.mealType);
    setModalTitle(meal.title);
    setModalDescription(meal.description || "");
    setModalCalories(meal.calories ? meal.calories.toString() : "");
    setModalPrepTime(meal.prepTime ? meal.prepTime.toString() : "");
    setModalTags(meal.tags || "");
    setShowModal(true);
  };

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const body = {
        id: editingMealId,
        dayOfWeek: modalDay,
        mealType: modalMealType,
        title: modalTitle.trim(),
        description: modalDescription.trim() || null,
        calories: modalCalories ? parseInt(modalCalories, 10) : null,
        prepTime: modalPrepTime ? parseInt(modalPrepTime, 10) : null,
        tags: modalTags.trim() || null,
      };

      const res = await fetch("/api/menu", {
        method: editingMealId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchMenu();
      }
    } catch (e) {
      console.error("Failed to save meal:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeal = async () => {
    if (!deleteConfirmMeal || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/menu?id=${deleteConfirmMeal.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirmMeal(null);
        fetchMenu();
      }
    } catch (e) {
      console.error("Failed to delete meal:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCompleted = async (meal: MealItem) => {
    const nextCompleted = !meal.isCompleted;

    // Instant optimistic update
    setMeals((prev) => {
      const updated = prev.map((m) =>
        m.id === meal.id ? { ...m, isCompleted: nextCompleted } : m
      );
      const cached = getCachedOfflineData<any>("weekly_menu");
      if (cached) {
        cacheOfflineData("weekly_menu", { ...cached, meals: updated });
      }
      return updated;
    });

    try {
      await offlineFetch("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: meal.id,
          isCompleted: nextCompleted,
        }),
        description: `Mark meal "${meal.title}" as ${nextCompleted ? "completed" : "pending"}`,
      });
    } catch (e) {
      console.error("Failed to toggle meal completion:", e);
    }
  };

  const handleResetToDefault = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET" }),
      });
      const data = await res.json();
      if (data.success) {
        setShowResetConfirm(false);
        fetchMenu();
      }
    } catch (e) {
      console.error("Failed to reset menu:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (preset: MealIdeaItem | (typeof PRESET_IDEAS)[0]) => {
    setModalTitle(preset.title);
    setModalDescription((preset as any).description || (preset as any).desc || "");
    setModalPrepTime(String((preset as any).prepTime || (preset as any).prep || ""));
    setModalCalories(String((preset as any).calories || (preset as any).cal || ""));
    setModalTags(preset.tags || "");
    if ((preset as any).mealType && (preset as any).mealType !== "ANY") {
      setModalMealType((preset as any).mealType);
    } else if ((preset as any).type) {
      setModalMealType((preset as any).type);
    }
  };

  const handleOpenCreateIdea = () => {
    setEditingIdea(null);
    setIdeaTitle("");
    setIdeaMealType(modalMealType || "ANY");
    setIdeaDescription("");
    setIdeaCalories("");
    setIdeaPrepTime("");
    setIdeaTags("");
    setShowIdeasManager(true);
  };

  const handleEditIdea = (idea: MealIdeaItem) => {
    setEditingIdea(idea);
    setIdeaTitle(idea.title);
    setIdeaMealType(idea.mealType);
    setIdeaDescription(idea.description || "");
    setIdeaCalories(idea.calories?.toString() || "");
    setIdeaPrepTime(idea.prepTime?.toString() || "");
    setIdeaTags(idea.tags || "");
    setShowIdeasManager(true);
  };

  const handleSaveIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaTitle.trim() || isSavingIdea) return;

    setIsSavingIdea(true);
    const payload = {
      id: editingIdea?.id,
      title: ideaTitle.trim(),
      mealType: ideaMealType,
      description: ideaDescription.trim() || null,
      calories: ideaCalories ? parseInt(ideaCalories, 10) : null,
      prepTime: ideaPrepTime ? parseInt(ideaPrepTime, 10) : null,
      tags: ideaTags.trim() || null,
    };

    try {
      const method = editingIdea ? "PATCH" : "POST";
      const res = await offlineFetch("/api/menu/ideas", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        description: `${editingIdea ? "Update" : "Create"} meal idea "${payload.title}"`,
      });
      const data = await res.json();
      if (data.success) {
        if (editingIdea) {
          setMealIdeas((prev) =>
            prev.map((item) => (item.id === editingIdea.id ? data.idea || { ...item, ...payload } : item))
          );
        } else {
          const newItem = data.idea || { ...payload, id: `temp_idea_${Date.now()}` };
          setMealIdeas((prev) => [...prev, newItem]);
        }
        setEditingIdea(null);
        setIdeaTitle("");
        setIdeaDescription("");
        setIdeaCalories("");
        setIdeaPrepTime("");
        setIdeaTags("");
        fetchIdeas();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingIdea(false);
    }
  };

  const handleDeleteIdea = async (id: string) => {
    setMealIdeas((prev) => prev.filter((i) => i.id !== id));
    setDeleteConfirmIdea(null);
    try {
      await offlineFetch(`/api/menu/ideas?id=${id}`, {
        method: "DELETE",
        description: `Delete meal idea ${id}`,
      });
      fetchIdeas();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetIdeas = async () => {
    if (!confirm("Reset meal ideas to default suggestions?")) return;
    try {
      const res = await offlineFetch("/api/menu/ideas?action=reset", {
        method: "POST",
        description: "Reset meal ideas to defaults",
      });
      const data = await res.json();
      if (data.success && data.ideas) {
        setMealIdeas(data.ideas);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter days based on tab selection
  const daysToRender =
    selectedDay === "ALL"
      ? DAYS_OF_WEEK
      : selectedDay === "TODAY"
      ? DAYS_OF_WEEK.filter((d) => d.key === currentDay)
      : DAYS_OF_WEEK.filter((d) => d.key === selectedDay);

  // Calculate high-level stats
  const totalPlannedMeals = meals.length;
  const totalCompletedMeals = meals.filter((m) => m.isCompleted).length;
  const todayPlannedCount = (groupedByDay[currentDay]
    ? Object.values(groupedByDay[currentDay]).filter(Boolean)
    : []
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/30 shadow-sm">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Weekly Menu &amp; Meal Planner
              </h1>
              <p className="text-xs text-slate-400">
                Pre-planned breakfast, lunch &amp; supper throughout your week — no more evening guesswork
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openAddModal(currentDay, "BREAKFAST")}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Plan a Meal</span>
          </button>

          <button
            onClick={() => setShowIdeasManager(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-xs text-amber-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Add, edit, or remove quick meal ideas"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Quick Ideas ({mealIdeas.length})</span>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Restore default healthy recipes"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Reset to Defaults</span>
          </button>
        </div>
      </div>

      {/* Pulse Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Today&apos;s Meals</span>
            <ChefHat className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {todayPlannedCount} / 3
          </div>
          <p className="text-[11px] text-amber-400 font-medium">
            Active for {currentDay.toLowerCase()}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Weekly Schedule</span>
            <Calendar className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {totalPlannedMeals} / 21
          </div>
          <p className="text-[11px] text-emerald-400 font-medium">
            Slots planned this week
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Meals Prepared</span>
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {totalCompletedMeals}
          </div>
          <p className="text-[11px] text-blue-400 font-medium">
            Checked off this cycle
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Avg Daily Prep Time</span>
            <Clock className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            ~75 mins
          </div>
          <p className="text-[11px] text-purple-400 font-medium">
            Across 3 balanced meals
          </p>
        </div>
      </div>

      {/* Day Selector Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedDay("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedDay === "ALL"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Full Week (7 Days)
          </button>

          <button
            onClick={() => setSelectedDay("TODAY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedDay === "TODAY"
                ? "bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Today ({currentDay.slice(0, 3)})</span>
          </button>

          {DAYS_OF_WEEK.map((d) => {
            const isToday = d.key === currentDay;
            const isSelected = selectedDay === d.key;
            return (
              <button
                key={d.key}
                onClick={() => setSelectedDay(d.key)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{d.short}</span>
                {isToday && (
                  <span className="ml-1 text-[9px] font-mono text-amber-400 font-bold">
                    •
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Meal Type Quick Filter */}
        <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs self-start sm:self-auto">
          {["ALL", "BREAKFAST", "LUNCH", "SUPPER"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedMealTypeFilter(type)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                selectedMealTypeFilter === type
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {type === "ALL" ? "All Meals" : type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Days Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
          <span>Loading weekly meal schedule...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {daysToRender.map((dayObj) => {
            const isCurrentDay = dayObj.key === currentDay;
            const dayMeals = groupedByDay[dayObj.key] || {};

            // Calculate day totals
            const dayMealList = Object.values(dayMeals).filter(Boolean) as MealItem[];
            const dayCalories = dayMealList.reduce(
              (acc, m) => acc + (m.calories || 0),
              0
            );
            const dayPrep = dayMealList.reduce(
              (acc, m) => acc + (m.prepTime || 0),
              0
            );

            return (
              <div
                key={dayObj.key}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 ${
                  isCurrentDay
                    ? "bg-slate-900/80 border-amber-500/40 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20"
                    : "bg-slate-900/50 border-slate-800/80"
                }`}
              >
                {/* Day Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base sm:text-lg font-bold text-white">
                      {dayObj.label}
                    </span>
                    {isCurrentDay && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Today
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    {dayCalories > 0 && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Flame className="h-3 w-3 text-rose-400" />
                        <span>~{dayCalories} kcal</span>
                      </span>
                    )}
                    {dayPrep > 0 && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="h-3 w-3 text-amber-400" />
                        <span>~{dayPrep} mins prep</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 Meal Slots Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
                  {MEAL_TYPES.map((typeMeta) => {
                    if (
                      selectedMealTypeFilter !== "ALL" &&
                      selectedMealTypeFilter !== typeMeta.key
                    ) {
                      return null;
                    }

                    const meal = dayMeals[typeMeta.key] as MealItem | null;
                    const IconComponent = typeMeta.icon;

                    if (!meal) {
                      return (
                        <div
                          key={typeMeta.key}
                          className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 hover:border-slate-700 flex flex-col justify-between min-h-[160px] transition-all group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                <IconComponent className="h-3.5 w-3.5" />
                                {typeMeta.label}
                              </span>
                              <span className="text-[10px] font-mono text-slate-600">
                                {typeMeta.timeLabel}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 pt-3">
                              No meal planned for this slot.
                            </p>
                          </div>

                          <button
                            onClick={() => openAddModal(dayObj.key, typeMeta.key)}
                            className="w-full mt-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer group-hover:border-slate-700 group-hover:text-white"
                          >
                            <Plus className="h-3 w-3 text-amber-400" />
                            <span>Plan {typeMeta.label}</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={typeMeta.key}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between min-h-[160px] ${
                          meal.isCompleted
                            ? "bg-slate-950/40 border-slate-800/60 opacity-75"
                            : "bg-slate-950/90 border-slate-800/90 hover:border-slate-700 shadow-sm"
                        }`}
                      >
                        <div className="space-y-2.5">
                          {/* Slot Header */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`p-1 rounded-md bg-slate-900 border border-slate-800 ${typeMeta.text}`}
                              >
                                <IconComponent className="h-3.5 w-3.5" />
                              </span>
                              <span className="font-bold text-slate-200">
                                {typeMeta.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditModal(meal)}
                                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                                title="Edit Meal"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmMeal(meal)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                                title="Clear / Delete Meal"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Meal Title & Checkbox */}
                          <div className="flex items-start gap-2.5 pt-0.5">
                            <button
                              onClick={() => handleToggleCompleted(meal)}
                              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                meal.isCompleted
                                  ? "bg-emerald-500 border-emerald-400 text-slate-950"
                                  : "border-slate-700 hover:border-slate-500 text-transparent"
                              }`}
                              title={
                                meal.isCompleted
                                  ? "Mark as uncompleted"
                                  : "Mark as prepared / eaten"
                              }
                            >
                              <Check className="h-3 w-3 stroke-[3]" />
                            </button>

                            <div className="space-y-1 min-w-0 flex-1">
                              <h4
                                className={`text-xs sm:text-sm font-bold leading-snug ${
                                  meal.isCompleted
                                    ? "line-through text-slate-400"
                                    : "text-slate-100"
                                }`}
                              >
                                {meal.title}
                              </h4>

                              {meal.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                  {meal.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Metadata Pills */}
                        <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono mt-3">
                          <div className="flex items-center gap-2">
                            {meal.prepTime && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Clock className="h-2.5 w-2.5 text-amber-400" />
                                <span>{meal.prepTime}m</span>
                              </span>
                            )}
                            {meal.calories && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Flame className="h-2.5 w-2.5 text-rose-400" />
                                <span>{meal.calories} kcal</span>
                              </span>
                            )}
                          </div>

                          {meal.tags && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 truncate max-w-[120px]">
                              {meal.tags.split(",")[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Plan / Edit Meal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  {editingMealId ? "Edit Meal Slot" : "Plan a Meal"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Inspiration Pills */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  Quick Idea Suggestions (Click to Fill):
                </span>
                <button
                  type="button"
                  onClick={() => setShowIdeasManager(true)}
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
                  title="Add, edit, or delete meal ideas"
                >
                  <Settings2 className="h-3 w-3" />
                  <span>Manage ({mealIdeas.length})</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {(mealIdeas.length > 0 ? mealIdeas : PRESET_IDEAS).map((p, idx) => (
                  <button
                    key={(p as any).id || idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 text-[10px] text-slate-300 font-medium transition-colors cursor-pointer"
                    title={(p as any).description || (p as any).desc || p.title}
                  >
                    {p.title.split("&")[0]}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleOpenCreateIdea}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-[10px] text-amber-300 font-medium transition-colors cursor-pointer flex items-center gap-1"
                  title="Add a new quick idea"
                >
                  <Plus className="h-3 w-3" />
                  <span>New Idea</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveMeal} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Day of Week
                  </label>
                  <select
                    value={modalDay}
                    onChange={(e) => setModalDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Meal Type
                  </label>
                  <select
                    value={modalMealType}
                    onChange={(e) => setModalMealType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="BREAKFAST">🌅 Breakfast (Morning)</option>
                    <option value="LUNCH">☀️ Lunch (Midday)</option>
                    <option value="SUPPER">🌙 Supper (Evening)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Meal Name / Dish Title
                </label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g. Ugali with Sukuma Wiki & Pan-Seared Beef"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Ingredients / Recipe Notes / Sides
                </label>
                <textarea
                  rows={2}
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="e.g. Fresh collard greens sautéed with onions and tomatoes; side of sliced ripe avocado."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Prep Time (Minutes)
                  </label>
                  <input
                    type="number"
                    value={modalPrepTime}
                    onChange={(e) => setModalPrepTime(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Estimated Calories (kcal)
                  </label>
                  <input
                    type="number"
                    value={modalCalories}
                    onChange={(e) => setModalCalories(e.target.value)}
                    placeholder="e.g. 650"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Tags / Focus (Comma separated)
                </label>
                <input
                  type="text"
                  value={modalTags}
                  onChange={(e) => setModalTags(e.target.value)}
                  placeholder="e.g. High Protein, Kenyan Classic, Quick Prep"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingMealId ? "Update Meal" : "Save Meal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmMeal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base">Delete this Meal?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Remove <span className="font-bold text-white">{deleteConfirmMeal.title}</span> for{" "}
              {deleteConfirmMeal.dayOfWeek} {deleteConfirmMeal.mealType.toLowerCase()}? You can always plan a new meal anytime.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmMeal(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMeal}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white"
              >
                {isSubmitting ? "Deleting..." : "Delete Meal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-bold text-white text-base">
                Reset to Default Healthy Menu?
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will repopulate all 7 days with the balanced, delicious weekly menu (Breakfast, Lunch &amp; Supper) so you have a complete plan.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleResetToDefault}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                {isSubmitting ? "Resetting..." : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK MEAL IDEAS MANAGER MODAL */}
      {showIdeasManager && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Quick Meal Ideas Bank
                  </h3>
                  <p className="text-xs text-slate-400">
                    Add, edit, and organize quick meal suggestions for 1-click slot planning.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowIdeasManager(false);
                  setEditingIdea(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form: Add or Edit Idea */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  {editingIdea ? (
                    <>
                      <Edit3 className="h-3.5 w-3.5 text-amber-400" />
                      Edit Idea: <span className="text-amber-400">{editingIdea.title}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 text-amber-400" />
                      Add New Quick Meal Idea
                    </>
                  )}
                </span>
                {editingIdea && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIdea(null);
                      setIdeaTitle("");
                      setIdeaDescription("");
                      setIdeaCalories("");
                      setIdeaPrepTime("");
                      setIdeaTags("");
                    }}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveIdea} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Meal Idea Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Avocado Toast with Poached Eggs"
                      value={ideaTitle}
                      onChange={(e) => setIdeaTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Category / Best For
                    </label>
                    <select
                      value={ideaMealType}
                      onChange={(e) => setIdeaMealType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="ANY">Any Meal (Breakfast, Lunch or Supper)</option>
                      <option value="BREAKFAST">Breakfast</option>
                      <option value="LUNCH">Lunch</option>
                      <option value="SUPPER">Supper</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Prep Time (mins)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 15"
                      value={ideaPrepTime}
                      onChange={(e) => setIdeaPrepTime(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Calories (kcal)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 420"
                      value={ideaCalories}
                      onChange={(e) => setIdeaCalories(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Quick, Protein"
                      value={ideaTags}
                      onChange={(e) => setIdeaTags(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Ingredients / Recipe Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short description or ingredients note..."
                    value={ideaDescription}
                    onChange={(e) => setIdeaDescription(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSavingIdea || !ideaTitle.trim()}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingIdea ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>{editingIdea ? "Save Changes" : "Add to Quick Ideas"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Ideas List */}
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Current Quick Ideas ({mealIdeas.length})
                </span>
                <button
                  type="button"
                  onClick={handleResetIdeas}
                  className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Reset to default Kenyan & balanced meal ideas"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset to Defaults</span>
                </button>
              </div>

              <div className="overflow-y-auto space-y-2 pr-1 max-h-64 border border-slate-800/80 rounded-xl p-2 bg-slate-950/40">
                {mealIdeas.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No meal ideas saved yet. Add one above or click &quot;Reset to Defaults&quot;.
                  </div>
                ) : (
                  mealIdeas.map((idea) => {
                    const badgeColor =
                      idea.mealType === "BREAKFAST"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : idea.mealType === "LUNCH"
                        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        : idea.mealType === "SUPPER"
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        : "bg-slate-800 text-slate-300 border-slate-700";

                    return (
                      <div
                        key={idea.id}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-white truncate">
                              {idea.title}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeColor}`}
                            >
                              {idea.mealType}
                            </span>
                            {idea.prepTime && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {idea.prepTime}m
                              </span>
                            )}
                            {idea.calories && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <Flame className="h-2.5 w-2.5 text-amber-400" />
                                {idea.calories} kcal
                              </span>
                            )}
                          </div>
                          {idea.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1">
                              {idea.description}
                            </p>
                          )}
                          {idea.tags && (
                            <div className="flex gap-1 pt-0.5">
                              {idea.tags.split(",").map((t, i) => (
                                <span
                                  key={i}
                                  className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-400"
                                >
                                  {t.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {showModal && (
                            <button
                              type="button"
                              onClick={() => {
                                applyPreset(idea);
                                setShowIdeasManager(false);
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[10px] font-medium text-amber-300 transition-colors cursor-pointer"
                              title="Fill into current meal form"
                            >
                              Use Now
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditIdea(idea)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Idea"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmIdea(idea)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Delete Idea"
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

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowIdeasManager(false);
                  setEditingIdea(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Meal Idea Confirmation Modal */}
      {deleteConfirmIdea && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <Trash2 className="h-5 w-5" />
              <h3 className="font-bold text-white text-base">
                Delete Meal Idea?
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete &quot;<span className="text-white font-medium">{deleteConfirmIdea.title}</span>&quot; from your Quick Ideas bank? Meals already planned on your weekly calendar will remain untouched.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmIdea(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteIdea(deleteConfirmIdea.id)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white"
              >
                Delete Idea
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
