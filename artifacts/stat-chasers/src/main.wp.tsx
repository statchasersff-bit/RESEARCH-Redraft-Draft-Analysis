import { createRoot } from "react-dom/client";
import { installStaticFetch } from "./lib/static-api";
import AppWP from "./AppWP";
import "./index.css";

installStaticFetch();

const mountEl =
  document.getElementById("statchasers-redraft-root") ??
  document.getElementById("root");

if (mountEl) {
  createRoot(mountEl).render(<AppWP />);
} else {
  document.body.innerHTML =
    '<div style="color:red;padding:2rem">StatChasers: mount element not found</div>';
}
