"use client";

import { useState, useEffect } from "react";
import { Download, Smartphone, X, Share } from "lucide-react";

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    // Check if already installed / running in standalone mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) return;

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Capture Chrome/Android/Desktop install prompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    window.addEventListener("appinstalled", () => {
      setIsStandalone(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSTip(true);
      return;
    }

    if (!deferredPrompt) {
      alert("To install Faida OS on your phone:\n1. Tap the browser menu (⋮)\n2. Select 'Install app' or 'Add to Home screen'");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="w-full flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-blue-900/30 via-slate-900 to-indigo-950/40 border border-blue-500/30 hover:border-blue-400 text-xs text-blue-300 font-semibold transition-all group cursor-pointer shadow-sm hover:shadow-blue-500/10"
        title="Install Faida OS on your device"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 group-hover:scale-105 transition-transform">
            <Smartphone className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <span className="block text-slate-100 font-bold text-[11px]">Install Faida OS</span>
            <span className="block text-[9px] text-blue-400/80">Use as phone app</span>
          </div>
        </div>
        <Download className="h-3.5 w-3.5 text-blue-400 group-hover:translate-y-0.5 transition-transform" />
      </button>

      {/* iOS Safari instructions modal */}
      {showIOSTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 shadow-2xl text-xs text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-400" />
                Install on iPhone / iPad
              </h3>
              <button onClick={() => setShowIOSTip(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              To install Faida OS as a standalone mobile app on iOS:
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-300">
              <li>Tap the <Share className="h-3 w-3 inline text-blue-400" /> <strong>Share</strong> button at the bottom of Safari.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top right corner.</li>
            </ol>
            <button
              onClick={() => setShowIOSTip(false)}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs mt-2"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
