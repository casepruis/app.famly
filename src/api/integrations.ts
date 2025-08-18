// src/api/integrations.ts
import { authClient } from "./authClient";

// Prefer env, fall back to localhost (Vite example)
const API_BASE = "http://localhost:8000";


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
};

export type InvokeLLMResponse = {
  /** Always: the parsed JSON from the model (any shape your schema dictates) */
  data: any;

  /** Convenience mirrors for your ChatWindow flow (present if model returned them) */
  summary?: string | null;
  tasks?: any[] | null;
  events?: any[] | null;
  wishlist_items?: any[] | null;

  /** Call metadata: token usage & cost */
  meta?: MetaOut | null;

  /** Optional raw text from the model (debugging) */
  _raw_text?: string | null;
};

export const InvokeLLM = async (
  body: InvokeLLMRequest
): Promise<InvokeLLMResponse> => {
  return fetchWithAuth("api/integrations/invoke_llm", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

/** Small helper if you want a one-liner for showing cost */
export const getLLMEstimatedCost = (res?: InvokeLLMResponse) =>
  res?.meta?.usage?.estimated_cost ? `${res.meta.usage.estimated_cost} ${res.meta.usage.currency}` : null;

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
