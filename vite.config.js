import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The web app lives in frontend/ (index.html, src/, public/).
// Builds go to dist/ at the repo root.
const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  envDir: here,
  build: {
    outDir: `${here}dist`,
    emptyOutDir: true,
  },
});
