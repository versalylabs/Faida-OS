"use client";

import { useEffect } from "react";

/**
 * Two small, global touches that make the glass feel alive. Neither needs any change to the pages:
 *  1. A soft ripple spreads from the exact point you tap on buttons and pill links.
 *  2. A light follows the pointer across glass cards (sets --mx / --my, used by the CSS).
 * Both are skipped when the visitor prefers reduced motion.
 */
export function ClickEffects() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const rippleTarget = (el: Element | null): HTMLElement | null => {
      const target = el?.closest<HTMLElement>("button, [role='button'], a[class*='rounded']");
      if (!target) return null;
      if ((target as HTMLButtonElement).disabled) return null;
      if (target.dataset.noRipple !== undefined) return null;
      return target;
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = rippleTarget(e.target as Element);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24 || rect.width > 700) return; // skip tiny hit areas and huge cards

      const host = document.createElement("span");
      host.className = "ripple-host";
      const dot = document.createElement("span");
      dot.className = "ripple-dot";
      const size = Math.max(rect.width, rect.height) * 2.1;
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - rect.left - size / 2}px`;
      dot.style.top = `${e.clientY - rect.top - size / 2}px`;
      host.appendChild(dot);

      if (getComputedStyle(target).position === "static") target.classList.add("ripple-rel");
      target.appendChild(host);
      setTimeout(() => host.remove(), 650);
    };

    let frame = 0;
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const card = (e.target as Element | null)?.closest<HTMLElement>("[class*='bg-slate-900']");
      if (!card) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
