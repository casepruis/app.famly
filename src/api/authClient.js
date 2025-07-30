// src/api/authClient.js
const API_BASE = "http://localhost:8000/api";

const saveUser = (user, token) => {
  localStorage.setItem("famlyai_user", JSON.stringify(user));
  localStorage.setItem("famlyai_token", token);
};

const getToken = () => localStorage.getItem("famlyai_token");

const getCurrentUser = () => {
  const stored = localStorage.getItem("famlyai_user");
  return stored ? JSON.parse(stored) : null;
};

export const authClient = {
  // Note: The URL has been updated to match your backend route (/api/auth/login)
  login: async (email, password) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: email,
        password,
      }),
    });

    if (!response.ok) throw new Error("Login failed");

    const { access_token } = await response.json();
    if (!access_token) throw new Error("No access token received");

    // ✅ Save token
    localStorage.setItem("famlyai_token", access_token);

    // ✅ Get user info
    const userRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user = await userRes.json();

    // ✅ Save user
    localStorage.setItem("famlyai_user", JSON.stringify(user));

    return user;
  },


  logout: () => {
    localStorage.removeItem("famlyai_user");
    localStorage.removeItem("famlyai_token");
  },

  me: async () => getCurrentUser(),
  getCurrentUser,
  isLoggedIn: () => !!getToken(),
  getToken,
};
