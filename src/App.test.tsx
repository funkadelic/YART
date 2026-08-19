import { render, screen, waitFor } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("renders the city list once the initial search resolves", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "City List" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
});
