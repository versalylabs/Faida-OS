"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children at the end of <body>, outside every card. A dialog inside a frosted card would
 * otherwise be boxed in by the card's glass effect (clipped, and drawn under later cards); from here it
 * always covers the whole screen. Renders nothing on the server.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
