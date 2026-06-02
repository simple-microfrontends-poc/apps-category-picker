import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchRootCategories, fetchCategory } from "./api";

const API_BASE = "http://localhost:8000";

function mockFetchOnce(body: unknown, init?: Partial<Response>) {
  const res = {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? "OK",
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
  return vi.fn().mockResolvedValue(res);
}

describe("category-picker api", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  describe("fetchRootCategories", () => {
    it("GETs /categories/roots and returns the parsed body", async () => {
      const body = [{ id: 1, name: "A", children: [] }];
      vi.stubGlobal("fetch", mockFetchOnce(body));

      const result = await fetchRootCategories();

      expect(fetch).toHaveBeenCalledWith(`${API_BASE}/categories/roots`);
      expect(result).toEqual(body);
    });

    it("throws on a non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetchOnce(null, { ok: false, status: 500, statusText: "Server Error" }),
      );

      await expect(fetchRootCategories()).rejects.toThrow("HTTP 500: Server Error");
    });
  });

  describe("fetchCategory", () => {
    it("GETs /categories/:id and returns the parsed body", async () => {
      const body = { id: 7, name: "A", children: [] };
      vi.stubGlobal("fetch", mockFetchOnce(body));

      const result = await fetchCategory(7);

      expect(fetch).toHaveBeenCalledWith(`${API_BASE}/categories/7`);
      expect(result).toEqual(body);
    });

    it("throws on a non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetchOnce(null, { ok: false, status: 404, statusText: "Not Found" }),
      );

      await expect(fetchCategory(9)).rejects.toThrow("HTTP 404: Not Found");
    });
  });
});
