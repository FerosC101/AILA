export const API_BASE_URL = import.meta.env.VITE_AILA_API_BASE_URL?.trim() ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(`API base URL is not configured for ${path}.`, 0);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(`Request failed for ${path}`, response.status);
  }

  return (await response.json()) as T;
}

export async function withLatency<T>(factory: () => T, ms = 220): Promise<T> {
  await delay(ms);
  return factory();
}
