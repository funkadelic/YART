import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DatasetPage } from "./features/DatasetPage";
import { CITY_PAGE } from "./features/cities/cityPage";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <DatasetPage config={CITY_PAGE} />
  </StrictMode>,
);
