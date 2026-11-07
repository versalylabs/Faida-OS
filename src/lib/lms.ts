/**
 * Turns whatever was saved in a task's `submissionUrl` into a link that works.
 *
 * Older calendar-feed (iCal) syncs saved the event's internal id there (for example
 * "12345@virtualcampus.kcau.ac.ke"), which a browser treats as a path on this app and
 * lands on an error page. Real web addresses are used as they are; a legacy id falls back
 * to the upcoming-events page of the LMS it came from, which is the closest working target
 * until a fresh sync stores the exact activity address.
 */
export function lmsLinkFor(value: string | null | undefined): { href: string; label: string } | null {
  if (!value) return null;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return { href: v, label: "Open in LMS" };

  const host = v.match(/@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i);
  if (host) return { href: `https://${host[1].toLowerCase()}/calendar/view.php?view=upcoming`, label: "Open LMS calendar" };

  return null;
}
