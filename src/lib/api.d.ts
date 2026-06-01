export interface Category {
    id: number;
    name: string;
    children: Category[];
}
/** Top-level categories — the entry level. Never loads the whole tree. */
export declare function fetchRootCategories(): Promise<Category[]>;
/** A single category with its direct children — used to drill one level down. */
export declare function fetchCategory(id: number): Promise<Category>;
//# sourceMappingURL=api.d.ts.map