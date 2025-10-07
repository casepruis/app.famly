// src/api/integrations.ts
import { authClient } from "./authClient";

// Tell TypeScript that window may have __API_BASE injected at runtime
declare global {
  interface Window {
    __API_BASE?: string;
  }
}


// Prefer env, fall back to localhost (Vite example)
// const API_BASE = "http://localhost:8000";
const API_BASE: string =
  (typeof window !== "undefined" && window.__API_BASE) ||
  (import.meta as any)?.env?.VITE_API_BASE ||
  "/api";


const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = authClient.getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };
  const res = await fetch(`${API_BASE}/${url.replace(/^\/+/, "")}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let detail: any;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    console.error("API error response:", detail);
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

/** ---------- LLM types ---------- */
export type InvokeLLMRequest = {
  prompt: string;
  /** Optional JSON Schema the backend will enforce/validate */
  response_json_schema?: Record<string, any>;
  /** Optional Azure deployment name override (uses backend default if omitted) */
  deployment?: string;
  /** Optional temperature (default 0.2 on backend) */
  temperature?: number;
  /** Optional system message override */
  system?: string;
  /** Optional strict validation toggle supported by your backend */
  strict?: boolean;
};

export type UsageOut = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  input_cost_per_1k: string;   // decimal string from backend env
  output_cost_per_1k: string;  // decimal string from backend env
  estimated_cost: string;      // decimal string (e.g., "0.0024")
  currency: string;            // e.g., "EUR"
};

export type MetaOut = {
  usage?: UsageOut;
  model?: string | null;
  deployment?: string | null;
  request_id?: string | null;
  validation_error?: string | null;
};

export type InvokeLLMResponse = {
  /** Always: the parsed JSON from the model (any shape your schema dictates) */
  data: any;

  /** Convenience mirrors for your flows (present if model returned them) */
  summary?: string | null;
  tasks?: any[] | null;
  events?: any[] | null;
  wishlist_items?: any[] | null;

  /** Call metadata: token usage & cost */
  meta?: MetaOut | null;

  /** Optional raw text from the model (debugging) */
  _raw_text?: string | null;
};

/** Small helper if you want a one-liner for showing cost */
export const getLLMEstimatedCost = (res?: InvokeLLMResponse) =>
  res?.meta?.usage?.estimated_cost ? `${res.meta.usage.estimated_cost} ${res.meta.usage.currency}` : null;

/** Base invoke (raw response passthrough) */
export const InvokeLLM = async (
  body: InvokeLLMRequest
): Promise<InvokeLLMResponse> => {
  return fetchWithAuth("/integrations/invoke_llm", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

/* ===================== */
/*  NORMALIZATION HELPERS */
/* ===================== */

// Narrowing helpers
const isArrayOfStrings = (arr: unknown): arr is string[] =>
  Array.isArray(arr) && arr.every((x) => typeof x === "string" && x.trim().length > 0);

const trimNonEmpty = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/**
 * Collect any task-like arrays from arbitrary keys:
 * - top-level keys that include "task" (case-insensitive), e.g. "Follow-up Tasks"
 * - common nested containers: "data", "result", "output"
 * - legacy fields: resp.tasks and resp.data.tasks
 */
export const extractSuggestedTasks = (resp: InvokeLLMResponse): string[] => {
  const out: string[] = [];

  const pushStrings = (val: unknown) => {
    if (!val) return;
    if (Array.isArray(val)) {
      for (const x of val) if (typeof x === "string" && x.trim()) out.push(x.trim());
      return;
    }
    if (typeof val === "string" && val.trim()) {
      // handle "a, b, c" or newline/bullet separated
      const split = val
        .split(/[\n\r•·]|,\s*/) // bullets, newlines, commas
        .map((s) => s.trim())
        .filter(Boolean);
      out.push(...split);
      return;
    }
    // try JSON array in string
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          for (const x of parsed) if (typeof x === "string" && x.trim()) out.push(x.trim());
        }
      } catch {
        /* ignore */
      }
    }
  };

  const scanObject = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (/task/i.test(k)) pushStrings(v); // catch "Follow-up Tasks", "tasks", etc.
    }
  };

  // scan various levels
  scanObject(resp);
  scanObject(resp?.data);
  scanObject((resp as any)?.result);
  scanObject((resp as any)?.output);

  // legacy explicit fields
  pushStrings(resp?.tasks);
  pushStrings(resp?.data?.tasks);

  // de-dup
  return [...new Set(out)];
};


/**
 * Try to pick a short title from common variants:
 * - "short_title", "shortTitle", "summary_title", etc.
 * - looks into top-level and common nested containers
 */
export const extractShortTitle = (resp: InvokeLLMResponse): string | null => {
  const candidates: unknown[] = [];

  const scan = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (
        /(^|[_\s-])short([_\s-]?title)?$/i.test(k) ||
        /summary[_\s-]?title/i.test(k)
      ) {
        candidates.push(v);
      }
    }
  };

  scan(resp);
  scan(resp?.data);
  scan((resp as any)?.result);
  scan((resp as any)?.output);

  const first = candidates.find((v) => typeof v === "string" && (v as string).trim());
  return first ? String(first).trim() : null;
};

/** Normalized shape convenient for UI code (keeps raw for debugging) */
export type NormalizedLLMResult = {
  short_title: string | null;
  suggestedTasks: string[];
  tasks: string[]; // mirror for legacy consumers
  summary: string | null;
  raw: InvokeLLMResponse;
};

/**
 * Invoke and normalize:
 * - collects task strings from any "*task*" key (e.g., "Follow-up Tasks")
 * - extracts a short_title from common variants
 * - preserves resp.summary if present (or data.summary)
 */
export const InvokeLLMNormalized = async (
  body: InvokeLLMRequest
): Promise<NormalizedLLMResult> => {
  const resp = await InvokeLLM(body);

  const summary = trimNonEmpty(resp?.summary) ?? trimNonEmpty(resp?.data?.summary) ?? null;
  const shortTitle = extractShortTitle(resp);
  const tasks = extractSuggestedTasks(resp);

  return {
    short_title: shortTitle,
    suggestedTasks: tasks,
    tasks, // duplicate for compatibility
    summary,
    raw: resp,
  };
};

/** ---------- Other integrations (stubs for now) ---------- */
export const SendEmail = async () => {
  console.log("🧪 SendEmail() called (stub)");
  return null;
};

export const UploadFile = async () => {
  console.log("🧪 UploadFile() called (stub)");
  return null;
};

export const GenerateImage = async () => {
  console.log("🧪 GenerateImage() called (stub)");
  return null;
};

export const ExtractDataFromUploadedFile = async () => {
  console.log("🧪 ExtractDataFromUploadedFile() called (stub)");
  return null;
};
