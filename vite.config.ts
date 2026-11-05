import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  base: "/celebration-of-life-global-platform/",

  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "esbuild",
    cssCodeSplit: true,
    emptyOutDir: true,
    target: "es2022",
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },
});
