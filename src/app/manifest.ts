import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Faida OS",
    short_name: "Faida OS",
    description: "Personal second brain, execution engine, and digital assistant.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // Lets the installed desktop app receive the LMS's sign-in reply (University > Connect LMS).
    protocol_handlers: [{ protocol: "web+faida", url: "/lms/sso#uri=%s" }],
    // Faida OS shows up in the phone's Share menu: shared text, links or an M-Pesa SMS land in Capture.
    share_target: {
      action: "/capture",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    // Long-press the app icon for these.
    shortcuts: [
      { name: "Capture", short_name: "Capture", description: "Add a task, reminder, note or expense", url: "/capture", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Add expense", short_name: "Expense", description: "Log money spent", url: "/capture?q=Spent%20KES%20", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Today", short_name: "Today", description: "What to do now and next", url: "/today", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
    background_color: "#0a1130",
    theme_color: "#05070f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        sizes: "32x32",
        type: "image/x-icon",
      },
    ],
  };
}
