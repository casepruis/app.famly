// src/api/authClient.js
const API_BASE = "http://localhost:8000/api";

// ---- URL normalization (optional trailing slash control) ----
const withTrailingSlash = (path) => {
  if (!path) return path;
  const [p, q] = path.split("?");
  if (p.endsWith("/")) return path;
  return q ? `${p}/?${q}` : `${p}/`;
};

// ---- In-flight de-dupe (collapse identical concurrent requests) ----
const inflight = new Map();

// ---- Core request with auth header + slash normalization ----
export const request = async (path, init = {}, { noSlash = false } = {}) => {
  const token = localStorage.getItem("famlyai_token");
  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const normalizedPath = noSlash ? path : withTrailingSlash(path);
  const url = `${API_BASE}${normalizedPath}`;
  const method = (init.method || "GET").toUpperCase();
  const key = `${method}|${url}`;

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    const res = await fetch(url, { ...init, headers });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = typeof body === "string" ? body : JSON.stringify(body);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
};

// ---- localStorage helpers ----
const saveUser = (user, token) => {
  if (token) localStorage.setItem("famlyai_token", token);
  localStorage.setItem("famlyai_user", JSON.stringify(user));
  localStorage.setItem("famlyai_user_cached_at", String(Date.now()));
};
const getUserCache = () => {
  const u = localStorage.getItem("famlyai_user");
  return u ? JSON.parse(u) : null;
};
const clearUser = () => {
  localStorage.removeItem("famlyai_user");
  localStorage.removeItem("famlyai_token");
  localStorage.removeItem("famlyai_user_cached_at");
};

// ---- TTL + singleton for /auth/me (prevents spam) ----
let mePromise = null;
const TTL_MS = 60_000; // 1 minute cache for /auth/me
const cacheFresh = () => {
  const ts = Number(localStorage.getItem("famlyai_user_cached_at") || 0);
  return Date.now() - ts < TTL_MS;
};

// ---- Public client ----
export const authClient = {
  login: async (email, password) => {
    const params = new URLSearchParams({ username: email, password });

    // Keep /auth/login without a trailing slash
    const { access_token } = await request(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      },
      { noSlash: true }
    );
    if (!access_token) throw new Error("No access token received");

    // IMPORTANT: call /auth/me WITHOUT trailing slash and WITH the fresh token
    const user = await request(
      "/auth/me",
      { headers: { Authorization: `Bearer ${access_token}` } },
      { noSlash: true }
    );

    saveUser(user, access_token);
    return user;
  },

  // Optional helpers (also no trailing slash if your backend expects it)
  checkEmail: async (email) =>
    request(`/auth/check-email?email=${encodeURIComponent(email)}`, {}, { noSlash: true }),

  signup: async (payload) =>
    request(
      "/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { noSlash: true }
    ),

  me: async () => {
    const token = localStorage.getItem("famlyai_token");
    if (!token) return getUserCache();
    if (cacheFresh()) return getUserCache();

    if (!mePromise) {
      // Avoid trailing-slash redirect here too
      mePromise = request("/auth/me", {}, { noSlash: true })
        .then((user) => {
          saveUser(user); // reuse existing token
          return user;
        })
        .catch((e) => {
          clearUser();
          throw e;
        })
        .finally(() => {
          mePromise = null;
        });
    }
    return mePromise;
  },

  logout: () => clearUser(),

  // convenience
  getCurrentUser: getUserCache,
  isLoggedIn: () => !!localStorage.getItem("famlyai_token"),
  getToken: () => localStorage.getItem("famlyai_token"),
};

export default authClient;
