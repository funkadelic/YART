import { getCities } from "./getCities";

describe("getCities", () => {
  it("returns every city when the search term is empty", async () => {
    const result = await getCities({ searchTerm: "" });
    expect(result.length).toBeGreaterThan(0);
  });

  it("matches on city name", async () => {
    const result = await getCities({ searchTerm: "tokyo" });
    expect(result.map((city) => city.name)).toContain("Tokyo");
  });

  it("matches on country name", async () => {
    const result = await getCities({ searchTerm: "japan" });

    expect(result.some((city) => city.country === "Japan")).toBe(true);

    // Matching is a substring search across name, ascii name, and country, so
    // a result need not be in Japan: "Pajapan, Mexico" matches on its name.
    expect(
      result.every((city) =>
        [city.name, city.nameAscii, city.country].some((field) =>
          field.toLowerCase().includes("japan"),
        ),
      ),
    ).toBe(true);
  });

  it("returns an empty list when nothing matches", async () => {
    const result = await getCities({ searchTerm: "zzzzzzzz" });
    expect(result).toHaveLength(0);
  });

  it("rejects when the search term is 'error'", async () => {
    await expect(getCities({ searchTerm: "error" })).rejects.toThrow();
  });
});
