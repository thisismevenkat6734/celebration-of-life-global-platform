import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";

function initializeCOL(): void {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error(
      "COL initialization failed: Root element was not found."
    );
  }

  const root = createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initializeCOL();
