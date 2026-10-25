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
} from "lucide-react";

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

  // Delete & Reset Confirmations
  const [deleteConfirmMeal, setDeleteConfirmMeal] = useState<MealItem | null>(
    null
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fetchMenu = async () => {
    try {
      const res = await fetch("/api/menu", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setMeals(data.meals || []);
        setGroupedByDay(data.groupedByDay || {});
        if (data.currentDay) {
          setCurrentDay(data.currentDay);
        }
      }
    } catch (e) {
      console.error("Failed to load menu data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
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
    try {
      const res = await fetch("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: meal.id,
          isCompleted: !meal.isCompleted,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Optimistic update
        setMeals((prev) =>
          prev.map((m) =>
            m.id === meal.id ? { ...m, isCompleted: !m.isCompleted } : m
          )
        );
        fetchMenu();
      }
    } catch (e) {
      console.error("Failed to toggle completion:", e);
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

  const applyPreset = (preset: (typeof PRESET_IDEAS)[0]) => {
    setModalTitle(preset.title);
    setModalDescription(preset.desc);
    setModalPrepTime(preset.prep.toString());
    setModalCalories(preset.cal.toString());
    setModalTags(preset.tags);
    setModalMealType(preset.type);
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
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Quick Idea Suggestions (Click to Fill):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_IDEAS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-[10px] text-slate-300 font-medium transition-colors cursor-pointer"
                  >
                    {p.title.split("&")[0]}
                  </button>
                ))}
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
    </div>
  );
}
