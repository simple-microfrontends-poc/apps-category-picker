const API_BASE = "http://localhost:8000";

export interface Category {
  id: number;
  name: string;
  children: Category[];
}

/** Top-level categories — the entry level. Never loads the whole tree. */
export async function fetchRootCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories/roots`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

/** A single category with its direct children — used to drill one level down. */
export async function fetchCategory(id: number): Promise<Category> {
  const res = await fetch(`${API_BASE}/categories/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}
