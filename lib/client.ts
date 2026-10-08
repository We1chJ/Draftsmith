// Browser-side fetch wrapper for our own /api routes.
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Not signed in");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// Multipart upload to our own /api routes.
export async function upload<T>(path: string, files: File[]): Promise<T> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch(path, { method: "POST", body: form });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Not signed in");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  return res.json();
}
