import React, { useCallback, useEffect, useRef, useState } from "react";
import "./styles/index.css";
import { Category, fetchCategory, fetchRootCategories } from "./lib/api";

/** A single node on the breadcrumb / selection path. */
export interface CategoryRef {
  id: number;
  name: string;
}

export interface CategorySelection {
  /** The chosen category. */
  id: number;
  name: string;
  /** Full path from a root down to (and including) the chosen category. */
  path: CategoryRef[];
}

export interface CategoryPickerProps {
  /** Called with the chosen category when the user confirms. */
  onSelect: (selection: CategorySelection) => void;
  /** Optional cancel handler — renders an "Anuluj" button when provided. */
  onCancel?: () => void;
  /**
   * "leaf" — only categories without children can be confirmed (e.g. assigning
   * a product to a concrete category).
   * "any"  — the current branch can also be confirmed (e.g. filtering, which on
   * the backend includes all descendants).
   */
  selectionMode?: "leaf" | "any";
  /** Label of the primary confirm button. */
  confirmLabel?: string;
  /** Heading shown above the breadcrumb. */
  title?: string;
}

const ROOT_KEY = "root" as const;

function CategoryPicker({
  onSelect,
  onCancel,
  selectionMode = "leaf",
  confirmLabel = "Wybierz",
  title = "Wybierz kategorię",
}: CategoryPickerProps) {
  const [path, setPath] = useState<CategoryRef[]>([]);
  const [items, setItems] = useState<Category[]>([]);
  const [selectedLeaf, setSelectedLeaf] = useState<CategoryRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cache each loaded level by its parent id (or ROOT_KEY) so navigating back
  // through the breadcrumb never re-fetches.
  const cache = useRef<Map<number | typeof ROOT_KEY, Category[]>>(new Map());

  const loadRoots = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      let roots = cache.current.get(ROOT_KEY);
      if (!roots) {
        roots = await fetchRootCategories();
        cache.current.set(ROOT_KEY, roots);
      }
      setItems(roots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się załadować kategorii");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoots();
  }, [loadRoots]);

  const handleNodeClick = async (node: Category) => {
    if (pendingId !== null) return;
    setPendingId(node.id);
    setError(null);
    try {
      let children = cache.current.get(node.id);
      if (!children) {
        const detail = await fetchCategory(node.id);
        children = detail.children;
        cache.current.set(node.id, children);
      }
      if (children.length > 0) {
        // Branch — drill one level down.
        setPath((p) => [...p, { id: node.id, name: node.name }]);
        setItems(children);
        setSelectedLeaf(null);
      } else {
        // Leaf — mark as the selection candidate.
        setSelectedLeaf({ id: node.id, name: node.name });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się załadować kategorii");
    } finally {
      setPendingId(null);
    }
  };

  const navigateToRoot = () => {
    setPath([]);
    setSelectedLeaf(null);
    setItems(cache.current.get(ROOT_KEY) ?? []);
  };

  const navigateTo = (index: number) => {
    const node = path[index];
    setPath(path.slice(0, index + 1));
    setSelectedLeaf(null);
    setItems(cache.current.get(node.id) ?? []);
  };

  const currentBranch = path.length > 0 ? path[path.length - 1] : null;
  const branchSelectable = selectionMode === "any" && currentBranch !== null;

  // A leaf selection always wins; otherwise (in "any" mode) the current branch.
  const target: CategoryRef | null =
    selectedLeaf ?? (branchSelectable ? currentBranch : null);

  const handleConfirm = () => {
    if (!target) return;
    const selectionPath = selectedLeaf ? [...path, selectedLeaf] : path;
    onSelect({ id: target.id, name: target.name, path: selectionPath });
  };

  return (
    <div className="flex flex-col bg-white rounded-lg border border-gray-200 w-full max-h-[70vh]">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            onClick={navigateToRoot}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              path.length === 0
                ? "text-gray-700 font-medium"
                : "text-indigo-600 hover:bg-indigo-50"
            }`}
          >
            Wszystkie
          </button>
          {path.map((node, i) => (
            <React.Fragment key={node.id}>
              <span className="text-gray-300">/</span>
              <button
                onClick={() => navigateTo(i)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  i === path.length - 1
                    ? "text-gray-700 font-medium"
                    : "text-indigo-600 hover:bg-indigo-50"
                }`}
              >
                {node.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-[12rem]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full" />
          </div>
        ) : error ? (
          <div className="m-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={path.length === 0 ? loadRoots : () => navigateTo(path.length - 1)}
              className="mt-2 text-sm text-red-700 underline"
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-gray-400">Brak kategorii.</p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((node) => {
              const isSelected = selectedLeaf?.id === node.id;
              const isPending = pendingId === node.id;
              return (
                <li key={node.id}>
                  <button
                    onClick={() => handleNodeClick(node)}
                    disabled={pendingId !== null}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    } ${pendingId !== null && !isPending ? "opacity-50" : ""}`}
                  >
                    <span>{node.name}</span>
                    {isPending ? (
                      <span className="animate-spin w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full" />
                    ) : isSelected ? (
                      <span className="text-indigo-500">✓</span>
                    ) : (
                      <span className="text-gray-300">›</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
        <div className="text-xs text-gray-500 truncate">
          {target ? (
            <>
              Wybrano: <span className="text-gray-700 font-medium">{target.name}</span>
            </>
          ) : selectionMode === "leaf" ? (
            "Wejdź do kategorii końcowej, aby ją wybrać"
          ) : (
            "Wybierz kategorię lub wejdź głębiej"
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Anuluj
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!target}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CategoryPicker;
