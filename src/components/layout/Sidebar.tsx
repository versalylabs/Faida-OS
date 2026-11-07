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
  Briefcase,
  Building2,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FaidaLogo } from "@/components/brand/FaidaLogo";
import { PWAInstallButton } from "@/components/pwa/PWAInstallButton";

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
    id: "business",
    title: "Business & Ventures",
    icon: Building2,
    items: [
      { name: "Business Hub", href: "/business", icon: Briefcase },
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
      { name: "Notes & Knowledge", href: "/notes", icon: BookOpen },
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
      { name: "Weekly Menu", href: "/menu", icon: UtensilsCrossed, badge: "Meals" },
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
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      <aside
        className={cn(
          "glass-panel w-[17rem] md:w-64 shrink-0 rounded-[28px] flex flex-col h-[calc(100dvh-1.5rem)] select-none fixed md:sticky top-3 left-3 md:left-auto md:ml-3 z-50 transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-[120%] md:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 shrink-0">
          <FaidaLogo size="md" showText={true} showSubtitle={true} href="/" />

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden glass-orb h-8 w-8 text-slate-300 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

      {/* Navigation List with Categorized Dropdowns */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5">
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
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-xl text-slate-400 hover:text-slate-100 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <CategoryIcon className="h-3 w-3 text-slate-500 group-hover:text-slate-300" />
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 group-hover:text-slate-100">
                    {category.title}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {hasActiveChild && isCollapsed && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6ee7d0] shadow-[0_0_8px_#6ee7d0]" />
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
                <div className="space-y-0.5 pt-0.5">
                  {category.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-200 border border-transparent",
                          isActive
                            ? "glass-active text-white font-semibold"
                            : "text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/10"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 transition-colors shrink-0",
                            isActive ? "text-[#a9f3e3]" : "text-slate-400 group-hover:text-slate-100"
                          )}
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                        {item.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/15 font-medium">
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
              "group relative flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden",
              isLazyActive
                ? "bg-gradient-to-br from-amber-300/35 to-amber-500/15 border border-amber-200/60 shadow-[0_10px_30px_-10px_rgba(255,184,107,0.8),inset_0_1px_0_rgba(255,255,255,0.5)]"
                : "bg-gradient-to-br from-amber-300/15 to-amber-500/5 border border-amber-200/25 hover:border-amber-200/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
            )}
          >
            {/* Animated warm glow pill */}
            <div className="glass-orb h-9 w-9 text-amber-300 shrink-0 group-hover:scale-105">
              <span className="text-sm">🛋️</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200 flex items-center gap-1.5">
                  Lazy Mode
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-200 border border-amber-200/30 font-semibold">
                  Effort
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
      <div className="p-3 border-t border-white/10 shrink-0 space-y-2">
        <PWAInstallButton />
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.07] border border-white/10">
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
