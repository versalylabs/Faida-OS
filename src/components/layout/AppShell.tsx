"use client";

import { useEffect, useState } from "react";
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
  const [refreshCount, setRefreshCount] = useState(0);

  // When a slow server finally answers after the page already showed its saved copy, reload the
  // page's data once so the fresh numbers replace the old ones. Skipped while the user is in the
  // middle of something (a dialog is open or a field is focused) so nothing they typed is lost.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdated = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const el = document.activeElement as HTMLElement | null;
        const typing = !!el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
        if (typing || document.querySelector(".fixed.inset-0")) return;
        setRefreshCount((n) => n + 1);
      }, 500);
    };
    window.addEventListener("faida-cache-updated", onUpdated);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("faida-cache-updated", onUpdated);
    };
  }, []);

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
          <div key={`${pathname}:${refreshCount}`} className="page-enter">
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
