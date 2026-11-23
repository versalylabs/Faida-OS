import { parseWithHeuristics } from "@/lib/ai/classifier";
import { parseMpesa } from "@/lib/mpesa";

/**
 * Splits one capture into the separate things it contains:
 *   "Buy milk, call John 3pm, paid 500 lunch"  ->  ["Buy milk", "call John 3pm", "paid 500 lunch"]
 *
 * Careful about what must stay whole:
 *   - an M-Pesa SMS (it is full of commas), a note or idea ("Idea: ..."), and anything long (a pasted text)
 *   - amounts like "2,500" (a comma followed by three digits is part of a number)
 *   - shopping lists: "Buy milk, eggs, bread" stays one shopping capture (the short pieces join the list)
 * Pure, so the rules can be tested.
 */

const MAX_ITEMS = 10;
// Pieces that start like this are their own item, never part of a shopping list
const ACTION_START = /^(call|ring|phone|text|sms|whatsapp|email|message|ping|pay|paid|spent|send|sent|received|finish|write|meet|meeting|book|submit|read|go|fix|review|check|remind|remember|clean|cook|study|update|prepare|plan|buy|get|pick up|idea|note|todo|to do)\b/i;

export function splitCapture(input: string): string[] {
  const text = input.trim();
  if (!text) return [];
  if (text.length > 400) return [text];
  if (/^(idea|note|til|shopping)\s*:/i.test(text)) return [text];
  if (parseMpesa(text)) return [text];

  const pieces = text
    .split(/\s*(?:;|\n|,(?!\d{3}\b)|\s+then\s+|\s+also\s+)\s*/i)
    .map((p) => p.trim().replace(/^(and|&)\s+/i, ""))
    .filter((p) => p.length > 0);
  if (pieces.length < 2) return [text];

  const out: string[] = [];
  for (const piece of pieces) {
    const prev = out[out.length - 1];
    const shortPlain = piece.split(/\s+/).length <= 3 && !/\d/.test(piece) && !ACTION_START.test(piece);
    if (prev && shortPlain && parseWithHeuristics(prev).type === "SHOPPING") {
      out[out.length - 1] = `${prev}, ${piece}`;
    } else {
      out.push(piece);
    }
  }
  if (out.length < 2) return [text];
  return out.slice(0, MAX_ITEMS);
}
