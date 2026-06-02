import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Category } from "./lib/api";

vi.mock("./lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/api")>();
  return { ...actual, fetchRootCategories: vi.fn(), fetchCategory: vi.fn() };
});

import CategoryPicker from "./CategoryPicker";
import { fetchRootCategories, fetchCategory } from "./lib/api";

const mockRoots = vi.mocked(fetchRootCategories);
const mockCategory = vi.mocked(fetchCategory);

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
