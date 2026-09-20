"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  CheckSquare,
  Calendar,
  FolderGit2,
  BookOpen,
  GraduationCap,
  Wallet,
  ShoppingCart,
  Wrench,
  BarChart3,
  Settings,
  FolderArchive,
  Terminal,
  ChevronDown,
  ChevronRight,
  Layers,
  Compass,
  Cpu,
  Brain,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
}

interface NavCategory {
  id: string;
  title: string;
  icon: any;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    id: "overview",
    title: "Mission Control",
    icon: Compass,
    items: [
      { name: "Command Center", href: "/", icon: LayoutDashboard },
      { name: "University", href: "/university", icon: GraduationCap, badge: "BSc" },
      { name: "Universal Capture", href: "/capture", icon: Sparkles, badge: "⚡" },
    ],
  },
  {
    id: "execution",
    title: "Execution & Planning",
    icon: Calendar,
    items: [
      { name: "Daily Planner", href: "/planner", icon: Calendar },
      { name: "Scheduler & Calendar", href: "/calendar", icon: Calendar },
      { name: "Tasks & Todos", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    id: "brain",
    title: "Second Brain",
    icon: Brain,
    items: [
      { name: "Projects", href: "/projects", icon: FolderGit2 },
      { name: "Notes", href: "/notes", icon: FileText },
      { name: "Knowledge Base", href: "/knowledge", icon: BookOpen },
      { name: "Learning Hub", href: "/learning", icon: GraduationCap },
      { name: "Files & Assets", href: "/files", icon: FolderArchive },
    ],
  },
  {
    id: "operations",
    title: "Life Operations",
    icon: Wallet,
    items: [
      { name: "Finance (KES)", href: "/finance", icon: Wallet },
      { name: "Smart Shopping", href: "/shopping", icon: ShoppingCart },
      { name: "Maintenance", href: "/maintenance", icon: Wrench },
    ],
  },
  {
    id: "system",
    title: "System & Insights",
    icon: Cpu,
    items: [
      { name: "Analytics & Journal", href: "/analytics", icon: BarChart3 },
      { name: "Developer Hub", href: "/developer", icon: Terminal },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const isLazyActive = pathname === "/lazy";

  const [mobileOpen, setMobileOpen] = useState(false);
  // State to track collapsed/expanded state of categories
  const [collapsedCategories, setCollapsedCategories] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    const handleToggleMobile = () => setMobileOpen((prev) => !prev);
    window.addEventListener("toggle-mobile-sidebar", handleToggleMobile);
    return () => window.removeEventListener("toggle-mobile-sidebar", handleToggleMobile);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Auto-expand category if active route is inside it
  useEffect(() => {
    for (const cat of navCategories) {
      if (cat.items.some((item) => item.href === pathname)) {
        setCollapsedCategories((prev) => ({ ...prev, [cat.id]: false }));
      }
    }
  }, [pathname]);

  const toggleCategory = (id: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
        />
      )}

      <aside
        className={cn(
          "w-64 border-r border-slate-800/80 bg-slate-950/95 md:bg-slate-950/80 backdrop-blur-md flex flex-col h-screen select-none fixed md:sticky top-0 z-50 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              ⚡
            </div>
            <div>
              <div className="font-bold tracking-wider text-slate-100 text-sm flex items-center gap-1.5">
                FAIDA <span className="text-blue-500 text-xs px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">OS</span>
              </div>
              <p className="text-[11px] text-slate-400">Personal Brain &amp; Assistant</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-200 text-sm p-1.5"
          >
            ✕
          </button>
        </div>

      {/* Navigation List with Categorized Dropdowns */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {navCategories.map((category) => {
          const isCollapsed = collapsedCategories[category.id] ?? false;
          const hasActiveChild = category.items.some((item) => item.href === pathname);
          const CategoryIcon = category.icon;

          return (
            <div key={category.id} className="space-y-1">
              {/* Category Dropdown Toggle Header */}
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <CategoryIcon className="h-3 w-3 text-slate-500 group-hover:text-slate-300" />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 group-hover:text-slate-200">
                    {category.title}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {hasActiveChild && isCollapsed && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  )}
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-slate-500 group-hover:text-slate-300 transition-transform" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-slate-500 group-hover:text-slate-300 transition-transform" />
                  )}
                </div>
              </button>

              {/* Sub-items list */}
              {!isCollapsed && (
                <div className="space-y-0.5 pl-1.5 pt-0.5 animate-in fade-in duration-150">
                  {category.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150",
                          isActive
                            ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm font-semibold"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/70"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5 transition-colors shrink-0",
                            isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                          )}
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Special Standalone 'Lazy Mode' Button at the Bottom (NO Category, prominently highlighted) */}
        <div className="pt-2">
          <Link
            href="/lazy"
            className={cn(
              "group relative flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 cursor-pointer overflow-hidden",
              isLazyActive
                ? "bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-yellow-500/25 border-2 border-amber-400/80 shadow-lg shadow-amber-500/20"
                : "bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/20 border border-amber-500/30 hover:border-amber-400 hover:shadow-md hover:shadow-amber-500/10"
            )}
          >
            {/* Animated warm glow pill */}
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
              <span className="text-sm">🛋️</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200 flex items-center gap-1.5">
                  Lazy Mode
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold animate-pulse">
                  EFFORT
                </span>
              </div>
              <p className="text-[10px] text-amber-400/70 truncate">
                Do less. Get outcomes.
              </p>
            </div>
          </Link>
        </div>
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 shrink-0">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/70 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] text-slate-300 font-medium">Faida Core: Online</span>
          </div>
          <Link href="/settings" className="text-slate-400 hover:text-slate-200">
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </aside>
    </>
  );
}
