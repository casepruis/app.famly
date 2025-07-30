// import { base44 } from './base44Client';


// export const FamilyMember = base44.entities.FamilyMember;

// export const ScheduleEvent = base44.entities.ScheduleEvent;

// export const Task = base44.entities.Task;

// export const Family = base44.entities.Family;

// export const FamilyInvitation = base44.entities.FamilyInvitation;

// export const UserWhitelist = base44.entities.UserWhitelist;

// export const WishlistItem = base44.entities.WishlistItem;

// export const Conversation = base44.entities.Conversation;

// export const ChatMessage = base44.entities.ChatMessage;



// // auth sdk:
// export const User = base44.auth;


// src/api/entities.js
// import { authClient } from './authClient';

// export const User = authClient;

// // 🧪 Mocked FamilyMember
// export const FamilyMember = {
//   filter: async () => [
//     { id: "1", name: "Kees", role: "parent", family_id: "family-123" },
//     { id: "2", name: "Denise", role: "parent", family_id: "family-123" },
//   ],
//   get: async (id) => ({ id, name: "Mock Member", family_id: "family-123" }),
//   update: async () => {},
// };

// // 🧪 Mocked ScheduleEvent
// export const ScheduleEvent = {
//   filter: async () => [
//     {
//       id: "event-1",
//       title: "Mock Soccer Game",
//       start_time: new Date().toISOString(),
//       end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
//       category: "sports",
//       family_id: "family-123",
//     },
//   ],
//   create: async (event) => event,
//   delete: async (id) => {},
// };

// // 🧪 Mocked Task
// export const Task = {
//   filter: async () => [
//     {
//       id: "task-1",
//       title: "Take out trash",
//       status: "todo",
//       due_date: new Date().toISOString(),
//       family_id: "family-123",
//     },
//   ],
//   create: async (task) => task,
//   delete: async (id) => {},
// };

// // 🧪 Mocked Family
// export const Family = {
//   get: async (id) => ({
//     id,
//     name: "The Pruis Family",
//     language: "nl",
//     subscription_plan: "cozy_nest",
//     subscription_status: "active",
//   }),
// };

// // 🧪 Mocked Conversation
// export const Conversation = {
//   filter: async () => [
//     {
//       id: "chat-1",
//       name: "Family Chat",
//       family_id: "family-123",
//       participants: ["1", "2"],
//       last_message_preview: "Don't forget dinner at 6!",
//       last_message_timestamp: new Date().toISOString(),
//     },
//   ],
// };

// // 🧪 Mocked ChatMessage
// export const ChatMessage = {
//   filter: async () => [
//     {
//       conversation_id: "chat-1",
//       sender_id: "1",
//       content: "What’s for dinner?",
//       message_type: "user_message",
//       read_by: ["2"],
//     },
//   ],
// };

// // 🧪 Safe stubs
// export const FamilyInvitation = {
//   filter: async () => [],
// };

// export const UserWhitelist = {
//   filter: async () => [],
// };

// export const WishlistItem = {
//   filter: async () => [],
// };
import { authClient } from "./authClient";

const API_BASE = "http://localhost:8000/";

const fetchWithAuth = async (url, options = {}) => {
  const token = authClient.getToken();

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
};


export const User = {
  ...authClient,
  login: authClient.login, // ✅ Explicitly define login
  logout: authClient.logout,
  me: authClient.me,
};

export const Task = {
  filter: () => fetchWithAuth("api/tasks"),
  create: (data) => fetchWithAuth("api/tasks", { method: "POST", body: JSON.stringify(data) }),
};

export const ScheduleEvent = {
  filter: () => fetchWithAuth("api/schedule_events"),
  upcoming: async () => {
  const all = await fetchWithAuth("api/schedule_events");
  const now = new Date();
  return all
    .filter(e => new Date(e.start_time) > now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 5); // Show only next 5 events
},
};

export const FamilyMember = {
  filter: () => fetchWithAuth("api/family_members"),
};

export const Family = {
  get: (id) => fetchWithAuth(`api/families/${id}`),
};

export const Conversation = {
  filter: () => fetchWithAuth("api/conversations"),
};

export const ChatMessage = {
  filter: () => fetchWithAuth("api/chat_messages"),
};

export const WishlistItem = {
  filter: () => fetchWithAuth("api/wishlist_items"),
};

export const UserWhitelist = {
  filter: () => fetchWithAuth("api/user_whitelist"),
};

export const FamilyInvitation = {
  filter: () => fetchWithAuth("api/family_invitations"),
};
