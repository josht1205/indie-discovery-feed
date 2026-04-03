import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Detect Tauri build (TAURI_ENV_* vars are set by the Tauri CLI)
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;
// Electron dev server runs on 5173; production uses relative file:// paths
const isElectronDev = process.env.ELECTRON_DEV === 'true';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: isTauri || isElectronDev ? 5173 : 8080,
    strictPort: isTauri,
  },
  // Tauri production uses absolute paths; Electron + web use relative
  base: isTauri ? "/" : "./",
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
  // Tauri env vars expose platform info to frontend
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // Tauri uses Chromium; relax browser compat targets
    target: isTauri ? ["chrome120", "safari17"] : "modules",
    // Don't minify for better debuggability during dev
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
