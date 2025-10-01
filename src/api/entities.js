// src/api/entities.js
import { authClient } from "./authClient";

const API_BASE = "http://localhost:8000/";

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

const fetchWithAuth = async (url, options = {}) => {
  const token = authClient.getToken?.();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (!res.ok) {
    let detail;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const err = new Error(`API error: ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    console.error("API error response:", detail);
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
};

// ---------- Users ----------
export const User = {
  // auth helpers (already implemented in your authClient)
  ...authClient,
  login: authClient.login,
  logout: authClient.logout,
  me: authClient.me,

  checkEmail: (email) =>
    fetchWithAuth(`api/auth/check-email?email=${encodeURIComponent(email)}`),

  signup: (payload) =>
    fetchWithAuth("api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // preferences (adjust path if your backend differs)
  updateMyUserData: (patch) =>
    fetchWithAuth("api/users/me", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
};

// ---------- Tasks ----------
export const Task = {
  list: () => fetchWithAuth(`api/tasks/all`),
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    // collection → ensure trailing slash
    return fetchWithAuth(
      ensureTrailingSlash(`api/tasks${query ? `?${query}` : ""}`)
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
    return fetchWithAuth("api/tasks/", {
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
    return fetchWithAuth(`api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  delete: (id) => fetchWithAuth(`api/tasks/${id}`, { method: "DELETE" }),

  bulkCreate: async (tasks = []) => {
    const results = [];
    for (const t of tasks) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await Task.create(t));
    }
    return results;
  },
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
  list: () => fetchWithAuth(`api/schedule_events`),
  filter: (params = {}, orderBy = null, limit = 1000) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(
      ensureTrailingSlash(`api/schedule_events${query ? `?${query}` : ""}`)
    );
  },

  get: (id) => fetchWithAuth(`api/schedule_events/${id}`),

  create: (data) => {
    const payload = sanitizeEventPayload(data);
    return fetchWithAuth("api/schedule_events/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: (id, data) => {
    const payload = sanitizeEventPayload(data);
    return fetchWithAuth(`api/schedule_events/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  delete: (id) => fetchWithAuth(`api/schedule_events/${id}`, { method: "DELETE" }),

  bulkCreate: async (events = []) => {
    const results = [];
    for (const e of events) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await ScheduleEvent.create(e));
    }
    return results;
  },

  upcoming: async () => {
    const all = await fetchWithAuth("api/schedule_events/");
    const now = new Date();
    return all
      .filter((e) => new Date(e.start_time) > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 5);
  },
};

// ---------- Family Members ----------
export const FamilyMember = {
  list: () => fetchWithAuth("api/family_members/"),

  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(
      ensureTrailingSlash(`api/family_members${query ? `?${query}` : ""}`)
    );
  },

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

  delete: (id) => fetchWithAuth(`api/family_members/${id}`, { method: "DELETE" }),
};

// ---------- Family ----------
export const Family = {
  get: (id) => fetchWithAuth(`api/families/${id}`),
  list: () => fetchWithAuth(`api/families/all`),
  updateName: (id, name) =>
    fetchWithAuth(`api/families/${id}/name`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
};

// ---------- Conversations ----------
export const Conversation = {
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(
      ensureTrailingSlash(`api/conversations${query ? `?${query}` : ""}`)
    );
  },

  get: (id) => fetchWithAuth(`api/conversations/${id}`),

  create: (data) =>
    fetchWithAuth("api/conversations/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Server will open existing (exact same participants) or create a new one */
  openOrCreate: ({ participant_member_ids, title, type } = {}) =>
    fetchWithAuth("api/conversations/open_or_create", {
      method: "POST",
      body: JSON.stringify({ participant_member_ids, title, type }),
    }),

  /** Open/create a 1:1 DM with the given member id */
  dm: (memberId) =>
    fetchWithAuth(`api/conversations/dm/${memberId}`, {
      method: "POST",
    }),

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


// ---------- Chat Messages ----------
export const ChatMessage = {
  filter: (params = {}, orderBy = null, limit = null) => {
    const query = buildQueryParams(params, orderBy, limit);
    return fetchWithAuth(
      ensureTrailingSlash(`api/chat_messages${query ? `?${query}` : ""}`)
    );
  },
  get: (id) => fetchWithAuth(`api/chat_messages/${id}`),
  create: (data) =>
    fetchWithAuth("api/chat_messages/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchWithAuth(`api/chat_messages/${id}`, {
      method: "DELETE",
    }),
};

// ---------- Wishlist Items ----------
export const WishlistItem = {
  filter: (params = {}) => {
    const query = buildQueryParams(params);
    return fetchWithAuth(
      ensureTrailingSlash(`api/wishlist_items${query ? `?${query}` : ""}`)
    );
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
  delete: (id) => fetchWithAuth(`api/wishlist_items/${id}`, { method: "DELETE" }),
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
  list: () => fetchWithAuth("api/user_whitelist/"),
  filter: () => fetchWithAuth("api/user_whitelist/"),
  create: (data) => {
    const payload = sanitizeEventPayload(data);
    return fetchWithAuth("api/user_whitelist/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update: (email, status) => {
    return fetchWithAuth(`api/user_whitelist/${encodeURIComponent(email)}?status=${encodeURIComponent(status)}`, {
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

    return fetchWithAuth('api/family_invitations/', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }, // add if your wrapper doesn’t set it
    });
  },

  list: () => fetchWithAuth('api/family_invitations/'),

  filter: (params) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return fetchWithAuth(`api/family_invitations/${qs}`);
  },
};
