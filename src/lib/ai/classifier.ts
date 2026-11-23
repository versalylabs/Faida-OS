import { APP_TIME_ZONE, zonedNow, zonedTime } from "@/lib/tz";

export type DetectedEntityType =
  | "TASK"
  | "REMINDER"
  | "EVENT"
  | "SHOPPING"
  | "NOTE"
  | "KNOWLEDGE"
  | "FINANCE"
  | "LEARNING";

export interface ParsedEntityResult {
  type: DetectedEntityType;
  title: string;
  details?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string | null;      // ISO string
  startTime?: string | null;    // ISO string
  endTime?: string | null;      // ISO string
  estimatedMinutes?: number;
  projectHint?: string;
  category?: string;
  tags?: string[];
  amount?: number;             // Financial amount (KES)
  transactionType?: "INCOME" | "EXPENSE";
  shoppingItems?: string[];    // Split items if shopping
  confidence: number;
  engine: "gemini" | "heuristic";
}

// -------------------------------------------------------------
// Date/Time Parsing Helpers
// -------------------------------------------------------------

/**
 * Works out the day and time in the app's time zone (Africa/Nairobi by default). The server runs in
 * UTC, so plain Date.setHours() would put "at 3pm" at 3 pm UTC, which is 6 pm in Nairobi.
 */
function parseRelativeDateTime(text: string, now: Date = new Date()): { dueDate?: Date; startTime?: Date; endTime?: Date } {
  const lower = text.toLowerCase();
  const today = zonedNow(now);
  let addDays = 0;

  // Check tomorrow
  if (lower.includes("tomorrow")) addDays = 1;

  // Check next weekday (e.g., "next friday", "on monday")
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < weekdays.length; i++) {
    const dayName = weekdays[i];
    if (lower.includes(`next ${dayName}`) || lower.includes(`on ${dayName}`)) {
      const currentDay = (today.dayOfWeek + addDays) % 7;
      let diff = i - currentDay;
      if (diff <= 0) diff += 7;
      addDays += diff;
      break;
    }
  }

  // Calendar day in the app's zone (noon UTC keeps date arithmetic clear of midnight edges)
  const dayKey = new Date(Date.UTC(today.year, today.month - 1, today.day + addDays, 12)).toISOString().slice(0, 10);

  // Check specific time: e.g. "at 3pm", "at 3:30pm", "at 15:00", "at 3"
  // Default time if none is given: 09:00, or the part of the day that was named
  let hours = /\btonight\b/.test(lower) ? 20 : /\bevening\b/.test(lower) ? 18 : /\bafternoon\b/.test(lower) ? 14 : 9;
  let minutes = 0;
  // "at 3pm", "at 3:30", "@ 15:00", or a bare "3pm" / "3:30 pm" (a bare number needs am/pm)
  const timeMatch =
    lower.match(/(?:\bat|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i) || lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3]?.toLowerCase();

    if (meridian === "pm" && hours < 12) hours += 12;
    if (meridian === "am" && hours === 12) hours = 0;
    if (!meridian && hours < 7) hours += 12; // default 3 -> 15:00
    hours = Math.min(hours, 23);
    minutes = Math.min(minutes, 59);
  }

  const targetDate = zonedTime(dayKey, `${hours}:${minutes}`);
  const start = new Date(targetDate);
  const end = new Date(targetDate.getTime() + 60 * 60 * 1000); // 1 hour event default

  return {
    dueDate: targetDate,
    startTime: start,
    endTime: end,
  };
}

// -------------------------------------------------------------
// Deterministic Heuristic Engine
// -------------------------------------------------------------

export function parseWithHeuristics(input: string): ParsedEntityResult {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. SHOPPING: "buy ...", "get ... and ...", "shopping: ..."
  if (
    lower.startsWith("buy ") ||
    lower.startsWith("shopping:") ||
    lower.startsWith("purchase ") ||
    lower.startsWith("pick up ") ||
    lower.includes("shopping list")
  ) {
    const rawItems = trimmed
      .replace(/^(buy|shopping:|purchase|pick up)\s+/i, "")
      .replace(/from\s+[\w\s]+/i, "")
      .trim();

    // Split by " and ", ",", "&"
    const splitItems = rawItems
      .split(/\s+and\s+|,|&/i)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => item.charAt(0).toUpperCase() + item.slice(1));

    return {
      type: "SHOPPING",
      title: splitItems.length > 0 ? splitItems.join(", ") : trimmed,
      shoppingItems: splitItems.length > 0 ? splitItems : [trimmed],
      category: "Supplies",
      confidence: 0.95,
      engine: "heuristic",
    };
  }

  // 2a. M-PESA message pasted straight from SMS, e.g.
  //   "UKR3H9X1AB Confirmed. Ksh500.00 sent to JOHN DOE 0712345678 on 7/11/26 at 2:15 PM. New M-PESA balance is Ksh1,234.00"
  //   "UKR3H9X1AB Confirmed. You have received Ksh2,000.00 from JANE DOE ..."
  const mpesaAmount = trimmed.match(/ksh\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (mpesaAmount && /confirmed/i.test(trimmed) && /(sent to|paid to|received|withdraw|bought|deposit)/i.test(trimmed)) {
    const amount = parseFloat(mpesaAmount[1].replace(/,/g, ""));
    const isIncome = /you have received|received ksh|deposit/i.test(trimmed) && !/sent to|paid to/i.test(trimmed);
    const party = trimmed.match(/(?:sent to|paid to|received from|from)\s+([A-Za-z][A-Za-z0-9 &.'-]{1,40}?)(?:\s+\d{9,}|\s+on\s|\.\s|$)/i)?.[1]?.trim();
    const label = party ? party.toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase()) : "M-Pesa";
    return {
      type: "FINANCE",
      title: `M-Pesa: ${isIncome ? "received from" : "paid to"} ${label}`,
      amount,
      transactionType: isIncome ? "INCOME" : "EXPENSE",
      category: isIncome ? "Income" : "M-Pesa",
      confidence: 0.97,
      engine: "heuristic",
    };
  }

  // 2. FINANCE: "spent KES 2500 on lunch", "paid KES 4,000 for electricity", "received KES 50,000"
  const financeRegex = /(?:spent|paid|received|earned|income|expense)\s*(?:kes|ksh)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:on|for|from)?\s*(.*)/i;
  const financeMatch = trimmed.match(financeRegex);
  if (financeMatch || lower.includes("kes ") || lower.includes("ksh ")) {
    const amountStr = financeMatch ? financeMatch[1].replace(/,/g, "") : trimmed.match(/[\d,]+(?:\.\d{1,2})?/)?.[0]?.replace(/,/g, "");
    const amount = amountStr ? parseFloat(amountStr) : 0;
    const isIncome = lower.includes("received") || lower.includes("earned") || lower.includes("income") || lower.includes("salary");
    const categoryHint = financeMatch?.[2]?.trim() || (isIncome ? "Income" : "General");

    return {
      type: "FINANCE",
      title: trimmed,
      amount,
      transactionType: isIncome ? "INCOME" : "EXPENSE",
      category: categoryHint.charAt(0).toUpperCase() + categoryHint.slice(1) || "General",
      confidence: 0.92,
      engine: "heuristic",
    };
  }

  // 3. CALENDAR EVENT: "meeting with...", "call with...", "sync with..."
  if (
    lower.startsWith("meeting with") ||
    lower.startsWith("call with") ||
    lower.startsWith("sync with") ||
    lower.startsWith("interview with")
  ) {
    const { startTime, endTime } = parseRelativeDateTime(trimmed);
    return {
      type: "EVENT",
      title: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
      startTime: startTime?.toISOString() || null,
      endTime: endTime?.toISOString() || null,
      confidence: 0.94,
      engine: "heuristic",
    };
  }

  // 4. REMINDER: "remind me to...", "remember to...", or a quick action with a time ("call John 3pm")
  const timedAction =
    /^(call|ring|phone|text|sms|whatsapp|email|message|ping|pay|send)\b/i.test(lower) &&
    /(\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\bat\s+\d{1,2}|\btomorrow\b|\btonight\b|\bthis (morning|afternoon|evening)\b)/i.test(lower);
  if (
    lower.startsWith("remind me to") ||
    lower.startsWith("remember to") ||
    lower.startsWith("reminder:") ||
    timedAction
  ) {
    // Drop the "when" words from the end ("... tomorrow at 9am"), however many there are
    let cleanTitle = trimmed.replace(/^(remind me to|remember to|reminder:)\s+/i, "");
    for (let i = 0; i < 3; i++) {
      cleanTitle = cleanTitle.replace(/\s+(next \w+day|on \w+day|this (?:morning|afternoon|evening)|tomorrow|tonight|today|at \d.*|\d{1,2}(:\d{2})?\s*(am|pm))$/i, "").trim();
    }

    const { dueDate } = parseRelativeDateTime(trimmed);

    return {
      type: "REMINDER",
      title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
      dueDate: dueDate?.toISOString() || null,
      priority: lower.includes("urgent") || lower.includes("important") ? "HIGH" : "MEDIUM",
      confidence: 0.96,
      engine: "heuristic",
    };
  }

  // 5. NOTE / KNOWLEDGE / IDEA:
  // "Idea: ...", "Note: ...", or technical statements e.g. "PostgreSQL uses MVCC..."
  if (
    lower.startsWith("idea:") ||
    lower.startsWith("note:") ||
    lower.startsWith("til:") ||
    lower.includes("uses ") ||
    lower.includes("architecture") ||
    lower.includes("algorithm") ||
    lower.includes("concept")
  ) {
    const isIdea = lower.startsWith("idea:");
    const cleanTitle = trimmed.replace(/^(idea:|note:|til:)\s+/i, "").trim();

    let category = "General";
    if (lower.includes("postgres") || lower.includes("database") || lower.includes("sql") || lower.includes("prisma")) {
      category = "Databases";
    } else if (lower.includes("react") || lower.includes("next.js") || lower.includes("css") || lower.includes("html")) {
      category = "Frontend";
    } else if (lower.includes("node") || lower.includes("api") || lower.includes("backend")) {
      category = "Backend";
    }

    return {
      type: isIdea ? "NOTE" : "KNOWLEDGE",
      title: cleanTitle.length > 60 ? cleanTitle.slice(0, 57) + "..." : cleanTitle,
      details: trimmed,
      category,
      tags: isIdea ? ["idea", category.toLowerCase()] : ["knowledge", category.toLowerCase()],
      confidence: 0.88,
      engine: "heuristic",
    };
  }

  // 6. TASK (Default execution entity):
  // "Test reservations", "Update docs", "Finish API docs for Melio"
  let priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "MEDIUM";
  if (lower.includes("urgent") || lower.includes("asap") || lower.includes("p0")) {
    priority = "URGENT";
  } else if (lower.includes("high") || lower.includes("p1") || lower.includes("important")) {
    priority = "HIGH";
  } else if (lower.includes("low") || lower.includes("minor")) {
    priority = "LOW";
  }

  // Extract project hint e.g., "for Melio", "in Faida OS"
  let projectHint: string | undefined;
  const projectMatch = trimmed.match(/(?:for|in|project:?)\s+([A-Za-z0-9_-]+)/i);
  if (projectMatch && !["tomorrow", "today", "friday", "the", "a"].includes(projectMatch[1].toLowerCase())) {
    projectHint = projectMatch[1];
  }

  // Extract estimated minutes e.g., "45m", "1h 30m", "2 hours"
  let estimatedMinutes = 30;
  const hoursMatch = lower.match(/(\d+)\s*(?:h|hour|hours)/);
  const minsMatch = lower.match(/(\d+)\s*(?:m|min|mins|minutes)/);
  if (hoursMatch || minsMatch) {
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    estimatedMinutes = hours * 60 + mins;
  }

  const { dueDate } = parseRelativeDateTime(trimmed);

  return {
    type: "TASK",
    title: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    priority,
    dueDate: dueDate ? dueDate.toISOString() : null,
    estimatedMinutes,
    projectHint,
    confidence: 0.85,
    engine: "heuristic",
  };
}

// -------------------------------------------------------------
// Hybrid AI Gateway (Gemini + Heuristic Fallback)
// -------------------------------------------------------------

export async function classifyUniversalInput(input: string): Promise<ParsedEntityResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    // Zero-latency deterministic parser
    return parseWithHeuristics(input);
  }

  try {
    const prompt = `You are Faida OS Universal Capture AI.
Classify the following user capture into one entity: TASK, REMINDER, EVENT, SHOPPING, NOTE, KNOWLEDGE, FINANCE, or LEARNING.
Extract:
- title: concise title
- type: TASK | REMINDER | EVENT | SHOPPING | NOTE | KNOWLEDGE | FINANCE | LEARNING
- details: any additional content
- priority: LOW | MEDIUM | HIGH | URGENT
- dueDate: ISO 8601 string if mentioned (current time ${new Date().toISOString()}; the user is in the ${APP_TIME_ZONE} time zone, so "3pm" means 3 pm there; give the UTC instant)
- startTime: ISO 8601 string if event
- endTime: ISO 8601 string if event
- estimatedMinutes: integer if task
- projectHint: project name if mentioned (e.g. Melio, Faida OS)
- category: general category
- tags: array of strings
- amount: number in Kenyan Shillings (KES) if financial
- transactionType: INCOME | EXPENSE if financial
- shoppingItems: array of individual item names if shopping (e.g. "toothpaste and HDMI cable" -> ["Toothpaste", "HDMI cable"])

Respond ONLY with valid JSON conforming to this schema.

User input: "${input}"`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn("Gemini API returned error, falling back to heuristics:", response.statusText);
      return parseWithHeuristics(input);
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) return parseWithHeuristics(input);

    const parsed = JSON.parse(textOutput);
    return {
      ...parsed,
      confidence: 0.98,
      engine: "gemini",
    };
  } catch (error) {
    console.error("Error in Gemini classifier, falling back to heuristics:", error);
    return parseWithHeuristics(input);
  }
}
