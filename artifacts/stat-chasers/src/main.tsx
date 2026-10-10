import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const mountEl =
  document.getElementById("statchasers-redraft-root") ??
  document.getElementById("root");

if (mountEl) {
  createRoot(mountEl).render(<App />);
} else {
  document.body.innerHTML =
    '<div style="color:red;padding:2rem">Mount element #root not found</div>';
}
