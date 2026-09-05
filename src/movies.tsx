import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import FilmsApp from "./FilmsApp";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container is missing from movies.html");
}

createRoot(container).render(
  <StrictMode>
    <FilmsApp />
  </StrictMode>,
);
