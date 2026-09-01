import { describe, expect, it } from "vitest";

import { collatorFor } from "../../i18n/format";
import { columns } from "./column";

/**
 * A row type the application never has, for the same reason the sorting tests
 * use one: the builder knows nothing about what it describes, so its tests say
 * nothing about the application's rows either.
 */
interface Part {
  sku: string;
  qty: number;
  unitPrice: number;
}

/**
 * A builder per test, because a builder rejects an id it has already issued and
 * several tests below describe the same column.
 *
 * The collator is on the base tag, because the factory no longer holds one and
 * every caller states which reader's ordering it is building for. Nothing in
 * this file depends on which tag it is; it depends on there being exactly one.
 */
const col = () => columns<Part>(collatorFor("en-US"));

function part(sku: string, qty: number, unitPrice: number): Part {
  return { sku, qty, unitPrice };
}

describe("columns().key", () => {
  it("reads the field its id names", () => {
    const column = col().key("sku", { label: "SKU" });

    expect(column.renderCell(part("A-1", 2, 5))).toBe("A-1");
  });

  it("carries its id and label through", () => {
    const column = col().key("qty", {
      label: "Quantity",
      width: "8rem",
      numeric: true,
    });

    expect(column.id).toBe("qty");
    expect(column.label).toBe("Quantity");
    expect(column.width).toBe("8rem");
    expect(column.numeric).toBe(true);
  });
});

describe("columns().accessor", () => {
  // The value is computed rather than read, so the id names nothing on the row
  // and the accessor is the only thing that knows where the value came from.
  it("renders the value its read function computes, not a field", () => {
    const column = col().accessor("total", (row) => row.qty * row.unitPrice, {
      label: "Total",
    });

    expect(column.id).toBe("total");
    expect(column.renderCell(part("A-1", 3, 4))).toBe("12");
  });

  it("orders by the computed value rather than as text", () => {
    const column = col().accessor("total", (row) => row.qty * row.unitPrice, {
      label: "Total",
    });
    const nine = part("A-1", 3, 3);
    const ten = part("B-2", 2, 5);

    // As text "10" precedes "9", so a column ordering these correctly is
    // ordering the numbers the accessor produced.
    expect(column.compare(nine, ten, "asc")).toBeLessThan(0);
    expect(column.compare(nine, ten, "desc")).toBeGreaterThan(0);
  });

  it("hands a supplied renderer the computed value and the whole row", () => {
    const seen: Array<[number, Part]> = [];
    const column = col().accessor("total", (row) => row.qty * row.unitPrice, {
      label: "Total",
      renderCell: (value, row) => {
        seen.push([value, row]);
        return `${row.sku}: ${value}`;
      },
    });
    const row = part("A-1", 3, 4);

    expect(column.renderCell(row)).toBe("A-1: 12");
    expect(seen).toEqual([[12, row]]);
  });

  it("hands a supplied comparator the computed values and the direction", () => {
    const seen: Array<[number, number, string]> = [];
    const column = col().accessor("total", (row) => row.qty * row.unitPrice, {
      label: "Total",
      compare: (a, b, direction) => {
        seen.push([a, b, direction]);
        return 0;
      },
    });

    expect(column.compare(part("A-1", 3, 4), part("B-2", 2, 5), "desc")).toBe(
      0,
    );
    expect(seen).toEqual([[12, 10, "desc"]]);
  });
});

describe("columns() defaults", () => {
  it("paints an empty cell for a nullish value rather than the word", () => {
    const column = col().accessor("note", (): string | null => null, {
      label: "Note",
    });

    expect(column.renderCell(part("A-1", 1, 1))).toBe("");
  });
});

describe("columns() id uniqueness", () => {
  it("rejects an id the same builder has already issued", () => {
    const builder = col();
    builder.key("sku", { label: "SKU" });

    expect(() => builder.key("sku", { label: "Code" })).toThrow(
      "Duplicate column id: sku",
    );
  });

  // Both methods share the one set of issued ids, so a computed column cannot
  // take the id a field column already has.
  it("rejects an id across key and accessor", () => {
    const builder = col();
    builder.key("qty", { label: "Quantity" });

    expect(() =>
      builder.accessor("qty", (row) => row.qty * 2, { label: "Double" }),
    ).toThrow("Duplicate column id: qty");
  });
});
