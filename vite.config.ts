import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Base configuration for Electron
  base: "./",
  
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    cors: true,
    watch: {
      // Ignore watching electron files
      ignored: ["**/electron/**", "**/dist-electron/**"],
    },
  },
  
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
