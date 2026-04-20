import "../welcome/index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import Credits from "./credits";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Credits />
  </React.StrictMode>,
);
