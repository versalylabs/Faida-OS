"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { FaidaAIChatDrawer } from "@/components/assistant/FaidaAIChatDrawer";
import { GlobalShortcutsHandler } from "@/components/shortcuts/ShortcutsModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 w-full max-w-full">
          {children}
        </main>
      </div>
      <FaidaAIChatDrawer />
      <GlobalShortcutsHandler />
    </>
  );
}
