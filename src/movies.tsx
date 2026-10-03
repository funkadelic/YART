import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DatasetPage } from "./features/DatasetPage";
import { FILM_PAGE } from "./features/films/filmPage";
import "yet-another-react-table/styles.css";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container is missing from movies.html");
}

createRoot(container).render(
  <StrictMode>
    <DatasetPage config={FILM_PAGE} />
  </StrictMode>,
);
