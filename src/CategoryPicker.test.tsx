import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Category } from "./lib/api";

vi.mock("./lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/api")>();
  return {
    ...actual,
    fetchRootCategories: vi.fn(),
    fetchCategory: vi.fn(),
    fetchCategoryPath: vi.fn(),
  };
});

import CategoryPicker from "./CategoryPicker";
import {
  fetchRootCategories,
  fetchCategory,
  fetchCategoryPath,
} from "./lib/api";

const mockRoots = vi.mocked(fetchRootCategories);
const mockCategory = vi.mocked(fetchCategory);
const mockPath = vi.mocked(fetchCategoryPath);

function cat(id: number, name: string, children: Category[] = []): Category {
  return { id, name, children };
}

// Roots only need id+name; the component always re-fetches a node's children.
const ROOTS = [cat(1, "Elektronika"), cat(2, "Książki")];
const ELEKTRONIKA = cat(1, "Elektronika", [cat(11, "Telefony"), cat(12, "Laptopy")]);
const TELEFONY = cat(11, "Telefony"); // leaf (no children)

beforeEach(() => {
  mockRoots.mockReset();
  mockCategory.mockReset();
  mockPath.mockReset();
  mockRoots.mockResolvedValue(ROOTS);
  mockCategory.mockImplementation(async (id: number) => {
    if (id === 1) return ELEKTRONIKA;
    if (id === 11) return TELEFONY;
    return cat(id, `cat-${id}`);
  });
});

describe("CategoryPicker — loading roots", () => {
  it("shows a spinner, then the root categories", async () => {
    let resolve!: (v: Category[]) => void;
    mockRoots.mockReturnValue(new Promise((r) => (resolve = r)));

    const { container } = render(<CategoryPicker onSelect={vi.fn()} />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    resolve(ROOTS);
    expect(await screen.findByText("Elektronika")).toBeInTheDocument();
    expect(screen.getByText("Książki")).toBeInTheDocument();
  });

  it("shows the empty state when there are no categories", async () => {
    mockRoots.mockResolvedValue([]);
    render(<CategoryPicker onSelect={vi.fn()} />);

    expect(await screen.findByText("Brak kategorii.")).toBeInTheDocument();
  });

  it("renders the title and confirm label from props", async () => {
    render(
      <CategoryPicker onSelect={vi.fn()} title="Wybierz dział" confirmLabel="OK" />,
    );

    expect(await screen.findByText("Wybierz dział")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });
});

describe("CategoryPicker — drilling and breadcrumb", () => {
  it("drills into a branch and shows its children + breadcrumb", async () => {
    const user = userEvent.setup();
    render(<CategoryPicker onSelect={vi.fn()} />);

    await user.click(await screen.findByText("Elektronika"));

    expect(await screen.findByText("Telefony")).toBeInTheDocument();
    expect(screen.getByText("Laptopy")).toBeInTheDocument();
    expect(mockCategory).toHaveBeenCalledWith(1);
    // breadcrumb now has a back-to "Wszystkie" plus the current branch.
    expect(screen.getByRole("button", { name: "Wszystkie" })).toBeInTheDocument();
  });

  it("does not re-fetch a level when navigating back to it (cache)", async () => {
    const user = userEvent.setup();
    render(<CategoryPicker onSelect={vi.fn()} />);

    await user.click(await screen.findByText("Elektronika"));
    await screen.findByText("Telefony");
    await user.click(screen.getByRole("button", { name: "Wszystkie" }));
    await user.click(await screen.findByText("Elektronika"));
    await screen.findByText("Telefony");

    // fetchCategory(1) only the first time.
    expect(mockCategory.mock.calls.filter((c) => c[0] === 1)).toHaveLength(1);
  });
});

describe("CategoryPicker — leaf selection (default mode)", () => {
  it("keeps confirm disabled until a leaf is chosen, then selects it with its path", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CategoryPicker onSelect={onSelect} />);

    await screen.findByText("Elektronika");
    const confirm = screen.getByRole("button", { name: "Wybierz" });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByText("Elektronika"));
    await user.click(await screen.findByText("Telefony"));

    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onSelect).toHaveBeenCalledWith({
      id: 11,
      name: "Telefony",
      path: [
        { id: 1, name: "Elektronika" },
        { id: 11, name: "Telefony" },
      ],
    });
  });

  it("does not allow confirming a branch in leaf mode", async () => {
    const user = userEvent.setup();
    render(<CategoryPicker onSelect={vi.fn()} />);

    await user.click(await screen.findByText("Elektronika"));
    await screen.findByText("Telefony");

    expect(screen.getByRole("button", { name: "Wybierz" })).toBeDisabled();
  });
});

describe("CategoryPicker — any mode (branch selectable)", () => {
  it("allows confirming the current branch", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CategoryPicker onSelect={onSelect} selectionMode="any" />);

    const confirm = await screen.findByRole("button", { name: "Wybierz" });
    expect(confirm).toBeDisabled(); // nothing selected at the root

    await user.click(screen.getByText("Elektronika"));
    await screen.findByText("Telefony");

    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onSelect).toHaveBeenCalledWith({
      id: 1,
      name: "Elektronika",
      path: [{ id: 1, name: "Elektronika" }],
    });
  });
});

describe("CategoryPicker — cancel and errors", () => {
  it("renders Anuluj only when onCancel is given and calls it", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<CategoryPicker onSelect={vi.fn()} onCancel={onCancel} />);

    await screen.findByText("Elektronika");
    await user.click(screen.getByRole("button", { name: "Anuluj" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows an error with retry, and recovers on retry", async () => {
    const user = userEvent.setup();
    mockRoots.mockRejectedValueOnce(new Error("Boom")).mockResolvedValueOnce(ROOTS);

    render(<CategoryPicker onSelect={vi.fn()} />);

    expect(await screen.findByText("Boom")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(await screen.findByText("Elektronika")).toBeInTheDocument();
  });
});

describe("CategoryPicker — initialized with categoryId (deep link)", () => {
  // 1 Elektronika > 11 Smartfony i akcesoria > 115 Smartfony > 1151 Apple iPhone
  const DEEP: Record<number, Category> = {
    1: cat(1, "Elektronika", [cat(11, "Smartfony i akcesoria")]),
    11: cat(11, "Smartfony i akcesoria", [cat(115, "Smartfony")]),
    115: cat(115, "Smartfony", [
      cat(1151, "Apple iPhone"),
      cat(1152, "Samsung Galaxy"),
      cat(1153, "Xiaomi"),
      cat(1154, "Google Pixel"),
    ]),
    1151: cat(1151, "Apple iPhone"), // leaf
  };
  const PATH_1151 = [
    { id: 1, name: "Elektronika" },
    { id: 11, name: "Smartfony i akcesoria" },
    { id: 115, name: "Smartfony" },
    { id: 1151, name: "Apple iPhone" },
  ];

  beforeEach(() => {
    mockCategory.mockImplementation(async (id: number) => DEEP[id] ?? cat(id, `cat-${id}`));
  });

  it("opens at the parent level of a leaf, with the leaf preselected", async () => {
    mockPath.mockResolvedValue(PATH_1151);
    render(<CategoryPicker categoryId={1151} onSelect={vi.fn()} />);

    // The leaf is listed and selected (the list button, not the footer label).
    const apple = await screen.findByRole("button", { name: /Apple iPhone/ });
    expect(apple.className).toContain("bg-indigo-50");

    // Sibling leaves are listed.
    expect(screen.getByText("Samsung Galaxy")).toBeInTheDocument();
    expect(screen.getByText("Google Pixel")).toBeInTheDocument();

    // Breadcrumb is root..parent.
    expect(screen.getByText("Elektronika")).toBeInTheDocument();
    expect(screen.getByText("Smartfony i akcesoria")).toBeInTheDocument();
    expect(screen.getByText("Smartfony")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Wybierz" })).toBeEnabled();
  });

  it("confirms the preselected leaf with its full path", async () => {
    mockPath.mockResolvedValue(PATH_1151);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CategoryPicker categoryId={1151} onSelect={onSelect} />);

    await screen.findByRole("button", { name: /Apple iPhone/ });
    await user.click(screen.getByRole("button", { name: "Wybierz" }));

    expect(onSelect).toHaveBeenCalledWith({
      id: 1151,
      name: "Apple iPhone",
      path: PATH_1151,
    });
  });

  it("enters a branch when initialized with a branch id", async () => {
    mockPath.mockResolvedValue([
      { id: 1, name: "Elektronika" },
      { id: 11, name: "Smartfony i akcesoria" },
    ]);
    render(<CategoryPicker categoryId={11} onSelect={vi.fn()} />);

    // Listed the branch's children; nothing selectable in leaf mode.
    expect(await screen.findByText("Smartfony")).toBeInTheDocument();
    expect(screen.getByText("Elektronika")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wybierz" })).toBeDisabled();
  });

  it("keeps breadcrumb navigation working (spine cached)", async () => {
    mockPath.mockResolvedValue(PATH_1151);
    const user = userEvent.setup();
    render(<CategoryPicker categoryId={1151} onSelect={vi.fn()} />);
    await screen.findByRole("button", { name: /Apple iPhone/ });

    // Jump back to Elektronika via the breadcrumb — its children come from cache.
    await user.click(screen.getByRole("button", { name: "Elektronika" }));
    expect(await screen.findByText("Smartfony i akcesoria")).toBeInTheDocument();
    expect(screen.queryByText("Apple iPhone")).not.toBeInTheDocument();
  });

  it("falls back to roots when the path lookup fails", async () => {
    mockPath.mockRejectedValue(new Error("nope"));
    render(<CategoryPicker categoryId={1151} onSelect={vi.fn()} />);

    expect(await screen.findByText("Książki")).toBeInTheDocument();
  });
});
