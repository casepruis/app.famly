import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "686430a34d7b61721eac46be", 
  requiresAuth: true // Ensure authentication is required for all operations
});
