import "./styles/index.css";
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
declare function CategoryPicker({ onSelect, onCancel, selectionMode, confirmLabel, title, }: CategoryPickerProps): import("react/jsx-runtime").JSX.Element;
export default CategoryPicker;
//# sourceMappingURL=CategoryPicker.d.ts.map