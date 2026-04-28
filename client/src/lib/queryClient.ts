import { QueryClient } from "@tanstack/react-query";

// __PORT_5000__ is replaced by deploy_website with the proxy path.
// When running locally (the token is unreplaced), use relative paths.
const RAW_BASE = "__PORT_5000__";
const API_BASE = RAW_BASE.startsWith("__") ? "" : RAW_BASE;

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
  }
  return res;
}

// Default queryFn: treat queryKey[0] as a relative API path
async function defaultQueryFn({ queryKey }: { queryKey: readonly unknown[] }) {
  const path = queryKey[0] as string;
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 30_000,
      retry: 1,
    },
  },
});
