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

import { authClient } from './authClient';

export const User = authClient; // Compatible with old User.me() pattern

// Temporary stubs for other Base44 entities (to avoid crashing the app)
export const FamilyMember = {
  filter: async () => [],
  get: async (id) => null,
  update: async (id, data) => {},
};

export const ScheduleEvent = {
  filter: async () => [],
  create: async (event) => event,
  delete: async (id) => {},
};

export const Task = {
  filter: async () => [],
  create: async (task) => task,
  delete: async (id) => {},
};

export const Family = {
  get: async (id) => null,
};

export const FamilyInvitation = {};
export const UserWhitelist = {};
export const WishlistItem = {};
export const Conversation = {};
export const ChatMessage = {};
