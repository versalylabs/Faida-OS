/**
 * A small client for free, OpenAI-compatible chat models (Groq, Cerebras, OpenRouter).
 *
 * Faida AI tries the providers in order and moves to the next one when a provider is rate-limited,
 * down, or rejects the model, so a free-tier hiccup does not stop the assistant. Keys come from the
 * environment and are never sent anywhere except the provider they belong to.
 */

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface LlmReply {
  message: ChatMessage;
  provider: string;
  model: string;
}

export class LlmUnavailableError extends Error {
  constructor(message: string, public attempts: string[] = []) {
    super(message);
  }
}

interface Provider {
  name: string;
  baseUrl: string;
  key: string;
  model: string;
}

const DEFAULTS: Record<string, { baseUrl: string; model: string; keyEnv: string; modelEnv: string; urlEnv: string }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", keyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", urlEnv: "GROQ_BASE_URL" },
  cerebras: { baseUrl: "https://api.cerebras.ai/v1", model: "gpt-oss-120b", keyEnv: "CEREBRAS_API_KEY", modelEnv: "CEREBRAS_MODEL", urlEnv: "CEREBRAS_BASE_URL" },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    urlEnv: "OPENROUTER_BASE_URL",
  },
};

/** The providers that have a key, in the order they will be tried. */
export function configuredProviders(): Provider[] {
  const order = (process.env.AI_PROVIDER_ORDER || "groq,cerebras,openrouter")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => DEFAULTS[s]);
  const out: Provider[] = [];
  for (const name of order) {
    const d = DEFAULTS[name];
    const key = process.env[d.keyEnv];
    if (!key) continue;
    out.push({ name, baseUrl: (process.env[d.urlEnv] || d.baseUrl).replace(/\/+$/, ""), key, model: process.env[d.modelEnv] || d.model });
  }
  return out;
}

export function isLlmConfigured(): boolean {
  return configuredProviders().length > 0;
}

const REQUEST_TIMEOUT_MS = 25_000;

async function callProvider(p: Provider, messages: ChatMessage[], tools: ToolSpec[] | undefined, signal?: AbortSignal): Promise<ChatMessage> {
  const body: Record<string, unknown> = {
    model: p.model,
    messages,
    temperature: 0.3,
    max_tokens: 800,
  };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${p.key}`,
      ...(p.name === "openrouter" ? { "X-Title": "Faida OS" } : {}),
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    let code = "";
    try {
      const j = await res.json();
      code = String(j?.error?.code || j?.error?.type || j?.error?.message || "").slice(0, 120);
    } catch {}
    const err: Error & { status?: number; retryAfter?: number; code?: string } = new Error(`${p.name} answered ${res.status} ${code}`);
    err.status = res.status;
    err.code = code;
    err.retryAfter = Number(res.headers.get("retry-after")) || undefined;
    throw err;
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  if (!msg) throw new Error(`${p.name} returned no message`);
  return {
    role: "assistant",
    content: typeof msg.content === "string" ? msg.content : null,
    tool_calls: Array.isArray(msg.tool_calls) && msg.tool_calls.length ? msg.tool_calls : undefined,
  };
}

/**
 * Sends the conversation to the first provider that answers. A rate limit with a short Retry-After is
 * waited out once; anything else moves on to the next provider.
 */
export async function chat(messages: ChatMessage[], tools?: ToolSpec[]): Promise<LlmReply> {
  const providers = configuredProviders();
  if (providers.length === 0) throw new LlmUnavailableError("No AI provider is configured");

  const attempts: string[] = [];
  for (const p of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const message = await callProvider(p, messages, tools);
        return { message, provider: p.name, model: p.model };
      } catch (e: any) {
        const status: number | undefined = e?.status;
        attempts.push(`${p.name}${status ? ` ${status}` : ""}${e?.code ? ` ${e.code}` : ""}`.trim());
        // Rate limited but only for a moment: wait and retry this provider once.
        if (status === 429 && e.retryAfter && e.retryAfter <= 3 && attempt === 0) {
          await new Promise((r) => setTimeout(r, e.retryAfter * 1000));
          continue;
        }
        // The model produced a malformed tool call: one more try often fixes it.
        if (status === 400 && /tool_use_failed|invalid_request/i.test(e?.code || "") && attempt === 0 && tools?.length) continue;
        break;
      }
    }
  }
  throw new LlmUnavailableError("All AI providers are busy or unavailable", attempts);
}
