export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export interface User {
  id: string;
  email: string;
  name: string;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("prepkit_token");
}

export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("prepkit_token", token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("prepkit_token");
  }
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}
