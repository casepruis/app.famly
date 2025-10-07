// Minimal types just to satisfy TS. Refine later if you want stricter typing.

export type User = any; // or define your real shape

export function request(
  path: string,
  init?: RequestInit,
  options?: { noSlash?: boolean }
): Promise<any>;

export const authClient: {
  login(email: string, password: string): Promise<User>;
  checkEmail(email: string): Promise<any>;
  signup(payload: any): Promise<any>;
  me(): Promise<User | null>;
  logout(): void;
  getCurrentUser(): User | null;
  isLoggedIn(): boolean;
  getToken(): string | null;
};

export default authClient;
