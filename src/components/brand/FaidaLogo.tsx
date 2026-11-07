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
  // Same liquid-glass artwork as the app icon (see scripts/generate-icons.cjs).
  const shapes = (
    <>
      <rect x="120" y="112" width="64" height="288" rx="32" />
      <path d="M152 112 H368 C385.6 112 396.8 129.6 390.4 145.6 L377.6 177.6 C373.6 186.4 364.8 192 355.2 192 H152 Z" />
      <path d="M152 228 H312 C326.4 228 334.4 244 326.4 255.2 L260 320 H308 C321.6 320 328.8 336 320 346.4 L216 432 C206.4 440 192 430.4 196.8 419.2 L224 356 H152 Z" />
    </>
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fl-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2c3b94" />
          <stop offset="0.5" stopColor="#101a48" />
          <stop offset="1" stopColor="#060c26" />
        </linearGradient>
        <radialGradient id="fl-glow-a" cx="0.18" cy="0.08" r="0.75">
          <stop offset="0" stopColor="#8d9dff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#8d9dff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fl-glow-b" cx="0.88" cy="0.96" r="0.7">
          <stop offset="0" stopColor="#6ee7d0" stopOpacity="0.5" />
          <stop offset="1" stopColor="#6ee7d0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fl-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fl-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.65" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#b9f5e8" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="fl-mark" x1="120" y1="110" x2="400" y2="440" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f3f5ff" />
          <stop offset="0.35" stopColor="#b7c3ff" />
          <stop offset="0.7" stopColor="#7d92ff" />
          <stop offset="1" stopColor="#4fe0c4" />
        </linearGradient>
        <linearGradient id="fl-mark-hi" x1="0" y1="110" x2="0" y2="330" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="fl-face">
          <rect width="512" height="512" rx="116" />
        </clipPath>
        <clipPath id="fl-mk">{shapes}</clipPath>
        <filter id="fl-drop" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#050a24" floodOpacity="0.5" />
        </filter>
      </defs>

      <rect width="512" height="512" rx="116" fill="url(#fl-bg)" />
      <g clipPath="url(#fl-face)">
        <rect width="512" height="512" fill="url(#fl-glow-a)" />
        <rect width="512" height="512" fill="url(#fl-glow-b)" />
        <rect width="512" height="300" fill="url(#fl-sheen)" />
      </g>
      <rect x="2.5" y="2.5" width="507" height="507" rx="113.5" fill="none" stroke="url(#fl-rim)" strokeWidth="5" />

      <g transform="translate(256 256) scale(1) translate(-258 -276)">
        <g filter="url(#fl-drop)">
          <g clipPath="url(#fl-mk)">
            <rect x="100" y="90" width="320" height="370" fill="url(#fl-mark)" />
            <rect x="100" y="90" width="320" height="230" fill="url(#fl-mark-hi)" />
          </g>
        </g>
        <circle cx="378" cy="146" r="15" fill="#ffffff" />
        <circle cx="378" cy="146" r="15" fill="none" stroke="#4fe0c4" strokeOpacity="0.9" strokeWidth="3" />
        <circle cx="214" cy="424" r="11" fill="#4fe0c4" />
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
