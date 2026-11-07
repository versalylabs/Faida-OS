"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { FaidaAIChatDrawer } from "@/components/assistant/FaidaAIChatDrawer";
import { GlobalShortcutsHandler } from "@/components/shortcuts/ShortcutsModal";
import { ClickEffects } from "@/components/effects/ClickEffects";
import { ServiceWorkerRegister } from "@/components/offline/ServiceWorkerRegister";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full text-slate-100 flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto px-3.5 py-5 sm:px-5 md:px-6 lg:px-8 lg:py-7 w-full max-w-full">
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>
      <FaidaAIChatDrawer />
      <GlobalShortcutsHandler />
      <ServiceWorkerRegister />
      <ClickEffects />
    </>
  );
}
