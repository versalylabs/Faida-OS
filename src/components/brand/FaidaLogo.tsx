import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FaidaLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showSubtitle?: boolean;
  href?: string;
  className?: string;
}

export function FaidaLogoIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
    >
      <defs>
        <linearGradient id="fl-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#090d16" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        <linearGradient id="fl-border" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.7" />
        </linearGradient>

        <linearGradient id="fl-top" x1="14" y1="12" x2="50" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        <linearGradient id="fl-bolt" x1="16" y1="26" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="45%" stopColor="#3b82f6" />
          <stop offset="85%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        <filter id="fl-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Squircle base */}
      <rect width="64" height="64" rx="16" fill="url(#fl-bg)" />
      <rect x="1" y="1" width="62" height="62" rx="15" stroke="url(#fl-border)" strokeWidth="1.5" fill="none" />

      {/* Internal ambient glow */}
      <circle cx="32" cy="30" r="18" fill="#3b82f6" fillOpacity="0.2" filter="url(#fl-glow)" />

      {/* Stylized F + Execution Bolt */}
      <g filter="url(#fl-glow)">
        {/* Vertical Spine */}
        <rect x="15" y="14" width="7" height="36" rx="3.5" fill="url(#fl-top)" />

        {/* Top Arm of F */}
        <path
          d="M19 14 H46 C48.2 14 49.6 16.2 48.8 18.2 L47.2 22.2 C46.7 23.3 45.6 24 44.4 24 H19 Z"
          fill="url(#fl-top)"
        />

        {/* Middle Lightning Bolt Arm */}
        <path
          d="M19 28.5 H39 C40.8 28.5 41.8 30.5 40.8 31.9 L32.5 40 H38.5 C40.2 40 41.1 42 40 43.3 L27 54 C25.8 55 24 53.8 24.6 52.4 L28 44.5 H19 Z"
          fill="url(#fl-bolt)"
        />

        {/* Cyber energy spark dots */}
        <circle cx="47.5" cy="18.5" r="2" fill="#38bdf8" />
        <circle cx="27" cy="53" r="1.5" fill="#10b981" />
      </g>
    </svg>
  );
}

export function FaidaLogo({
  size = "md",
  showText = true,
  showSubtitle = false,
  href = "/",
  className,
}: FaidaLogoProps) {
  const pixelSizes = {
    xs: 24,
    sm: 28,
    md: 36,
    lg: 44,
    xl: 56,
  };

  const px = pixelSizes[size];

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 group cursor-pointer", className)}>
      <div className="relative">
        <FaidaLogoIcon
          size={px}
          className="transition-transform duration-300 group-hover:scale-105 group-hover:shadow-blue-500/20"
        />
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <div className="font-bold tracking-wider text-slate-100 flex items-center gap-1.5 leading-none">
            <span
              className={cn(
                "tracking-tight font-extrabold bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent",
                size === "xs" && "text-xs",
                size === "sm" && "text-sm",
                size === "md" && "text-base",
                size === "lg" && "text-xl",
                size === "xl" && "text-2xl"
              )}
            >
              FAIDA
            </span>
            <span
              className={cn(
                "font-mono font-bold px-1.5 py-0.5 rounded border leading-none",
                "bg-blue-500/10 text-blue-400 border-blue-500/20",
                size === "xs" && "text-[9px]",
                size === "sm" && "text-[10px]",
                size === "md" && "text-xs",
                size === "lg" && "text-xs",
                size === "xl" && "text-sm"
              )}
            >
              OS
            </span>
          </div>
          {showSubtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              Personal Operating System
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="inline-block">{content}</Link>;
  }

  return content;
}
