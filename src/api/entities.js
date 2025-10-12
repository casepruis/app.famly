// src/api/entities.js
import { authClient } from "./authClient";

// const API_BASE = "http://localhost:8000/";

const API_BASE =
  (typeof window !== "undefined" && window.__API_BASE) // set by index.html at runtime (optional)
  || (import.meta?.env?.VITE_API_BASE)                // Vite build-time (optional)
  || "/api";                                          // default: same-origin; nginx proxies to backend


// --- helpers ---
const ensureTrailingSlash = (u) => {
  // add a trailing slash before ?query (avoids FastAPI 307s on collection routes)
  if (!u) return u;
  const [p, q] = u.split("?");
  if (!p.endsWith("/")) {
    return q ? `${p}/?${q}` : `${p}/`;
  }
  return q ? `${p}?${q}` : p;
};

const buildQueryParams = (params = {}, orderBy = null, limit = null) => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) q.append(k, v);
  });
  if (orderBy) q.append("order_by", orderBy);
  if (limit) q.append("limit", String(limit));
  return q.toString();
};

// api/http.ts (or wherever fetchWithAuth lives)
// --- helpers ---
export async function fetchWithAuth(path, options = {}) {
  const base =
    (import.meta && import.meta.env && (import.meta.env.VITE_API_BASE || "") || "").replace(/\/+$/, "") ||
    "/api";
  const url = path.startsWith("http") ? path : `${base}${path}`;

  const token = localStorage.getItem("famlyai_token") || "";
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // If a body is present and no explicit content-type, default to JSON
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const req = {
    credentials: "same-origin",
    ...options,
    headers,
  };

  const res = await fetch(url, req);

  // 204/205: no content
  if (res.status === 204 || res.status === 205) return null;

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  // Read the body exactly once on the main Response
  let data;
  try {
    data = isJson ? await res.json() : await res.text();
  } catch (e) {
    data = undefined;
  }

  if (!res.ok) {
    // Try to surface a useful message
    let errText = "";
    try {
      const clone = res.clone();
      errText = await clone.text();
    } catch (_) {}
    const msg =
      (typeof data === "string" && data) ||
      errText ||
      `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status; // handy upstream
    throw err;
  }

  return data;
}



// const fetchWithAuth = async (url, options = {}) => {
//   const token = authClient.getToken?.();
//   const headers = {
//     ...(options.headers || {}),
//     ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     "Content-Type": "application/json",
//   };

//   const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

//   if (!res.ok) {
//     let detail;
//     try {
//       detail = await res.json();
//     } catch {
//       detail = await res.text();
//     }
//     const err = new Error(`API error: ${res.status}`);
//     err.status = res.status;
//     err.detail = detail;
//     console.error("API error response:", detail);
//     throw err;
//   }
//   const ct = res.headers.get("content-type") || "";
//   return ct.includes("application/json") ? res.json() : res.text();
// };

// ---------- Users ----------
export const User = {
  // auth helpers (already implemented in your authClient)
  ...authClient,
  login: authClient.login,
  logout: authClient.logout,
  me: authClient.me,

  checkEmail: (email) =>
    fetchWithAuth(`/auth/check-email?email=${encodeURIComponent(email)}`),

  signup: (payload) =>
    fetchWithAuth("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // preferences (adjust path if your backend differs)
  updateMyUserData: (patch) =>
    fetchWithAuth("/users/me", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
};

// ---------- Tasks ----------
export const Task = {
  list: () => fetchWithAuth(`/tasks/all`),
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    // collection → ensure trailing slash
    return fetchWithAuth(
      ensureTrailingSlash(`/tasks${query ? `?${query}` : ""}`)
    );
  },

  create: (data) => {
    const payload = { ...data };
    if (!payload.id) delete payload.id;
    if (payload.due_date === "" || payload.due_date == null)
      delete payload.due_date;
    if (payload.assigned_to && !Array.isArray(payload.assigned_to)) {
      payload.assigned_to = [payload.assigned_to].flat().filter(Boolean);
    }
    return fetchWithAuth("/tasks/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: (id, data) => {
    const payload = { ...data };
    if (payload.due_date === "") payload.due_date = null;
    if (payload.assigned_to && !Array.isArray(payload.assigned_to)) {
      payload.assigned_to = [payload.assigned_to].flat().filter(Boolean);
    }
    return fetchWithAuth(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  delete: (id) => fetchWithAuth(`/tasks/${id}`, { method: "DELETE" }),

  bulkCreate: async (tasks = []) => {
    const results = [];
    for (const t of tasks) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await Task.create(t));
    }
    return results;
  },
  // Convert a task to an event
  toEvent: (taskId, payload = {}) =>
    fetchWithAuth(`/tasks/${taskId}/to-event`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ---------- Schedule Events ----------
const VALID_EVENT_CATEGORIES = new Set([
  "school",
  "work",
  "sports",
  "medical",
  "social",
  "family",
  "other",
  "holiday",
  "studyday",
  "outing",
]);

const normalizeOutgoingDate = (value, { end = false } = {}) => {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(value)) return value; // already tz-aware
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return end ? `${value}T23:59:00` : `${value}T00:00:00`;
    }
    return value; // naive local datetime string
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
};

const sanitizeEventPayload = (e) => {
  const payload = { ...e };
  payload.start_time = normalizeOutgoingDate(payload.start_time, { end: false });
  payload.end_time = normalizeOutgoingDate(payload.end_time, { end: true });
  if (!Array.isArray(payload.family_member_ids)) {
    payload.family_member_ids = payload.family_member_ids
      ? [payload.family_member_ids].flat()
      : [];
  }
  if (payload.category && !VALID_EVENT_CATEGORIES.has(payload.category)) {
    payload.category = "other";
  }
  return payload;
};

export const ScheduleEvent = {
  list: () => fetchWithAuth(`/schedule_events`),
  filter: (params = {}, orderBy = null, limit = 1000) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(
      ensureTrailingSlash(`/schedule_events${query ? `?${query}` : ""}`)
    );
  },

  get: (id) => fetchWithAuth(`/schedule_events/${id}`),

  create: (data) => {
    const payload = sanitizeEventPayload(data);
    return fetchWithAuth("/schedule_events/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: (id, data) => {
    const payload = sanitizeEventPayload(data);
    return fetchWithAuth(`/schedule_events/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  delete: (id) => fetchWithAuth(`/schedule_events/${id}`, { method: "DELETE" }),

  bulkCreate: async (events = []) => {
    const results = [];
    for (const e of events) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await ScheduleEvent.create(e));
    }
    return results;
  },

  upcoming: async () => {
    const all = await fetchWithAuth("/schedule_events/");
    const now = new Date();
    return all
      .filter((e) => new Date(e.start_time) > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 5);
  },
  // Convert an event to a task
  toTask: (eventId, payload = {}) =>
    fetchWithAuth(`/schedule_events/${eventId}/to-task`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ---------- Family Members ----------
export const FamilyMember = {
  list: () => fetchWithAuth("/family_members/"),

  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(
      ensureTrailingSlash(`/family_members${query ? `?${query}` : ""}`)
    );
  },

  get: (id) => fetchWithAuth(`/family_members/${id}`),

  me: () => fetchWithAuth("/family_members/me"),

  create: (data) =>
    fetchWithAuth("/family_members/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    fetchWithAuth(`/family_members/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id) => fetchWithAuth(`/family_members/${id}`, { method: "DELETE" }),
};

// ---------- Family ----------
export const Family = {
  get: (id) => fetchWithAuth(`/families/${id}`),
  list: () => fetchWithAuth(`/families/all`),
  updateName: (id, name) =>
    fetchWithAuth(`/families/${id}/name`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
};

// ---------- Conversations ----------
export const Conversation = {
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(
      ensureTrailingSlash(`/conversations${query ? `?${query}` : ""}`)
    );
  },

  get: (id) => fetchWithAuth(`/conversations/${id}`),

  create: (data) =>
    fetchWithAuth("/conversations/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Server will open existing (exact same participants) or create a new one */
  openOrCreate: ({ participant_member_ids, title, type } = {}) =>
    fetchWithAuth("/conversations/open_or_create", {
      method: "POST",
      body: JSON.stringify({ participant_member_ids, title, type }),
    }),

  /** Open/create a 1:1 DM with the given member id */
  dm: (memberId) =>
    fetchWithAuth(`/conversations/dm/${memberId}`, {
      method: "POST",
    }),

  update: (id, data) =>
    fetchWithAuth(`/conversations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  markAsRead: (conversationId) =>
    fetchWithAuth(`/chat_messages/conversation/${conversationId}/mark_read`, {
      method: "POST",
    }),
};


// ---------- Chat Messages ----------
export const ChatMessage = {
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(`/chat_messages${query ? `?${query}` : ""}`);
  },
  get: (id) => fetchWithAuth(`/chat_messages/${id}`),
  create: (data) =>
    fetchWithAuth("/chat_messages/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchWithAuth(`/chat_messages/${id}`, {
      method: "DELETE",
    }),
  emptyConversation: (id) =>
    fetchWithAuth(`/chat_messages/conversation/${id}`, {
      method: "DELETE",
    }),  
};

// ---------- Wishlist Items ----------
export const WishlistItem = {
  filter: (params = {}) => {
    const query = buildQueryParams(params);
    return fetchWithAuth(
      ensureTrailingSlash(`/wishlist_items${query ? `?${query}` : ""}`)
    );
  },
  create: (data) =>
    fetchWithAuth("/wishlist_items/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    fetchWithAuth(`/wishlist_items/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) => fetchWithAuth(`/wishlist_items/${id}`, { method: "DELETE" }),
  bulkCreate: async (items = []) => {
  const results = [];
  for (const t of items) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await WishlistItem.create(t));
  }
  return results;
},
};

// ---------- Misc ----------
export const UserWhitelist = {
  list: () => fetchWithAuth("/user_whitelist/"),
  filter: () => fetchWithAuth("/user_whitelist/"),
  create: (data) => {
    const payload = sanitizeEventPayload(data);
    return fetchWithAuth("/user_whitelist/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update: (email, status) => {
    return fetchWithAuth(`/user_whitelist/${encodeURIComponent(email)}?status=${encodeURIComponent(status)}`, {
      method: "PUT",
    });
  },

};

export const FamilyInvitation = {
  create: (data) => {
    // Build a clean payload (do NOT run sanitizeEventPayload here)
    const payload = {
      email: (data.email || '').toLowerCase(),
      family_id: data.family_id,
    };
    if (data.status) payload.status = data.status; // optional, defaults to 'pending' server-side
    if (data.invited_by) payload.invited_by = data.invited_by; // optional; server defaults to current user

    return fetchWithAuth('/family_invitations/', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }, // add if your wrapper doesn’t set it
    });
  },

  list: () => fetchWithAuth('/family_invitations/'),

  filter: (params) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return fetchWithAuth(`/family_invitations/${qs}`);
  },
};

export const Push = {
  getVapidPublicKey: () => fetchWithAuth('/push/vapid-public-key'),
  subscribe: (payload) =>
    fetchWithAuth('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};