import type { DashboardDoc } from "@dashboard/shared";

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response;
}

export async function fetchDashboard(): Promise<DashboardDoc> {
  return (await request("/api/dashboard")).json();
}

export async function saveDashboard(doc: DashboardDoc): Promise<DashboardDoc> {
  const response = await request("/api/dashboard", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  return response.json();
}

export async function toggleEntity(entityId: string): Promise<void> {
  await request(`/api/entities/${encodeURIComponent(entityId)}/toggle`, { method: "POST" });
}
