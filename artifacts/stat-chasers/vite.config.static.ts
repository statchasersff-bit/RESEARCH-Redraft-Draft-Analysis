import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? "22582");
const basePath = process.env.BASE_PATH ?? "/";

// Data files live in public/data/ — Vite serves them at /data/ in dev mode
// and copies them into dist/public/data/ during build automatically.

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  // publicDir defaults to "public" — covers public/data/ → /data/
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    // Replit serves this dev server over HTTPS on 443 via its proxy. The Vite
    // HMR client (loaded in the page) must open its websocket back through that
    // same 443 proxy — not the raw dev-server port, which the browser can't
    // reach. Pinning clientPort:443 + protocol:"wss" makes hot-reload work
    // automatically on the *.replit.dev URL.
    hmr: {
      clientPort: 443,
      protocol: "wss",
    },
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  },
});
