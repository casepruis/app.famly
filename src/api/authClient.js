// src/api/authClient.js

const API_BASE = 'http://localhost:8000'; // Change to your actual backend URL if needed
const bypass = true; // 🔁 Toggle between mock and real backend

let currentUser = {
  email: "test@example.com",
  full_name: "Demo User",
  family_id: "family-123",
  role: "member",
  notification_settings: {
    chat_notifications: true,
    task_reminders: true,
    event_reminders: true
  }
};

async function backendLogin(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error('Login failed');
  currentUser = await response.json();
  return currentUser;
}

async function backendLogout() {
  // Optionally implement session/token revocation later
  currentUser = null;
}

async function backendGetCurrentUser() {
  return currentUser;
}

async function bypassLogin(email, password) {
  currentUser = {
    email,
    full_name: "Demo User",
    role: "member",
    family_id: "family-001",
    push_subscription: null,
    notification_settings: {
      chat_notifications: true,
      task_reminders: true,
      event_reminders: true,
    },
  };
  console.log("✅ Bypass login active:", currentUser);
  return currentUser;
}

async function bypassLogout() {
  console.log("✅ Bypass logout");
  currentUser = null;
}

async function bypassGetCurrentUser() {
  return currentUser;
}

export const authClient = {
  login: bypass ? bypassLogin : backendLogin,
  logout: bypass ? bypassLogout : backendLogout,
  getCurrentUser: bypass ? bypassGetCurrentUser : backendGetCurrentUser,
  isLoggedIn: () => !!currentUser,
  me: async () => currentUser  // 👈 This line mimics Base44 SDK
};
