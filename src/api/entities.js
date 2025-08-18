// src/api/entities.js (or .ts if you're using TS)
import { authClient } from "./authClient";

const API_BASE = "http://localhost:8000/";

// src/api/entities.js (or .ts)
const fetchWithAuth = async (url, options = {}) => {
  const token = authClient.getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch { detail = await res.text(); }
    const err = new Error(`API error: ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    console.error("API error response:", detail);
    throw err;
  }
  return res.json();
};


function buildQueryParams(params = {}, orderBy = null, limit = null) {
  const query = new URLSearchParams();

  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null) {
      query.append(key, params[key]);
    }
  }

  if (orderBy) query.append("order_by", orderBy);
  if (limit) query.append("limit", limit);

  return query.toString();
}

/* ---------------- Users ---------------- */
export const User = {
  ...authClient,
  login: authClient.login,
  logout: authClient.logout,
  me: authClient.me,
};

/* ---------------- Tasks ---------------- */
export const Task = {
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(`api/tasks${query ? `?${query}` : ""}`);
  },

  create: (data) => {
    const payload = { ...data };
    // Don't send id for new tasks
    if (!payload.id) delete payload.id;
    // Don't send empty due_date (let server infer)
    if (payload.due_date === "" || payload.due_date == null) delete payload.due_date;
    // Normalize assignees
    if (payload.assigned_to && !Array.isArray(payload.assigned_to)) {
      payload.assigned_to = [payload.assigned_to].flat().filter(Boolean);
    }
    return fetchWithAuth("api/tasks/", { method: "POST", body: JSON.stringify(payload) });
  },

  update: (id, data) => {
    const payload = { ...data };
    if (payload.due_date === "") payload.due_date = null;
    if (payload.assigned_to && !Array.isArray(payload.assigned_to)) {
      payload.assigned_to = [payload.assigned_to].flat().filter(Boolean);
    }
    return fetchWithAuth(`api/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },

  delete: (id) => fetchWithAuth(`api/tasks/${id}`, { method: "DELETE" }),
};

/* ---------------- Schedule Events ---------------- */
const toIsoString = (v) => {
  if (!v) return v;
  if (v instanceof Date) return v.toISOString();
  // if it's already a string, trust it
  return v;
};
const VALID_EVENT_CATEGORIES = new Set([
  "school", "work", "sports", "medical", "social", "family", "other", "holiday", "studyday", "outing"
]);

function normalizeOutgoingDate(value, { end = false } = {}) {
  if (!value) return value;

  // If it's a Date instance -> send ISO (backend will parse)
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "string") {
    // If it already includes timezone info, keep as-is
    if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(value)) return value;

    // Date-only -> expand to local 00:00 or 23:59, keep naive (no Z)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return end ? `${value}T23:59:00` : `${value}T00:00:00`;
    }

    // Datetime without timezone -> keep as-is (naive local)
    // e.g. "2025-09-01T08:00:00"
    return value;
  }

  // Fallback: try Date coercion
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toISOString();
}

const sanitizeEventPayload = (e) => {
  const payload = { ...e };

  payload.start_time = normalizeOutgoingDate(payload.start_time, { end: false });
  payload.end_time   = normalizeOutgoingDate(payload.end_time,   { end: true  });

  if (!Array.isArray(payload.family_member_ids)) {
    payload.family_member_ids = payload.family_member_ids ? [payload.family_member_ids].flat() : [];
  }

  if (payload.category && !VALID_EVENT_CATEGORIES.has(payload.category)) {
    payload.category = "other";
  }

  return payload;
};

export const ScheduleEvent = {
  filter: () => fetchWithAuth("api/schedule_events"),
  upcoming: async () => {
    const all = await fetchWithAuth("api/schedule_events");
    const now = new Date();
    return all
      .filter((e) => new Date(e.start_time) > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 5);
  },

  /** Create a single event (POST /api/schedule_events/) */
  create: async (data) => {
    const payload = sanitizeEventPayload(data);
    // ⚠️ FastAPI route is @router.post("/") → include trailing slash
    return fetchWithAuth("api/schedule_events/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** Convenience: create many events sequentially and collect results */
  bulkCreate: async (events = []) => {
    const results = [];
    for (const e of events) {
      // Fail fast if any required field is obviously missing
      if (!e || !e.title || !e.start_time || !e.end_time || !e.family_id) {
        console.warn("Skipping invalid event in bulkCreate:", e);
        continue;
      }
      // Create one-by-one so we can surface partial success
      // (If you later add a backend bulk endpoint, swap to that here.)
      // eslint-disable-next-line no-await-in-loop
      const created = await ScheduleEvent.create(e);
      results.push(created);
    }
    return results;
  },
};

/* ---------------- Family Members ---------------- */
export const FamilyMember = {
  list: () => fetchWithAuth("api/family_members/"),
  filter: () => fetchWithAuth("api/family_members/"),
  get: (id) => fetchWithAuth(`api/family_members/${id}`),
  me: () => fetchWithAuth("api/family_members/me"),
  create: (data) =>
    fetchWithAuth("api/family_members/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    fetchWithAuth(`api/family_members/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchWithAuth(`api/family_members/${id}`, {
      method: "DELETE",
    }),
};

/* ---------------- Family ---------------- */
export const Family = {
  get: (id) => fetchWithAuth(`api/families/${id}`),
};

/* ---------------- Conversations ---------------- */
export const Conversation = {
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(`api/conversations${query ? `?${query}` : ""}`);
  },
  get: (id) => fetchWithAuth(`api/conversations/${id}`),
  update: (id, data) =>
    fetchWithAuth(`api/conversations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  markAsRead: (conversationId) =>
    fetchWithAuth(`api/chat_messages/conversation/${conversationId}/mark_read`, {
      method: "POST",
    }),
};

/* ---------------- Chat Messages ---------------- */
export const ChatMessage = {
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(`api/chat_messages${query ? `?${query}` : ""}`);
  },
  get: (id) => fetchWithAuth(`api/chat_messages/${id}`),
  create: (data) =>
    fetchWithAuth("api/chat_messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchWithAuth(`api/conversations/${id}`, {
      method: "DELETE",
    }),
};

/* ---------------- Wishlist Items ---------------- */
export const WishlistItem = {
  filter: (params = {}) => {
    const query = buildQueryParams(params);
    return fetchWithAuth(`api/wishlist_items/${query ? `?${query}` : ""}`); // ← note the /
  },
  create: (data) =>
    fetchWithAuth("api/wishlist_items/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    fetchWithAuth(`api/wishlist_items/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchWithAuth(`api/wishlist_items/${id}`, {
      method: "DELETE",
    }),
};
/* ---------------- Misc ---------------- */
export const UserWhitelist = {
  filter: () => fetchWithAuth("api/user_whitelist"),
};

export const FamilyInvitation = {
  filter: () => fetchWithAuth("api/family_invitations"),
};
