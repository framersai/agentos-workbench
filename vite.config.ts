import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    port: 5175,
    open: true,
    proxy: {
      "/api/agentos": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
