import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Exclude Node.js built-ins that shouldn't be polyfilled
      exclude: ['fs', 'net', 'tls', 'child_process', 'dgram', 'dns']
    }),
    {
      name: 'replace-node-events',
      enforce: 'pre',
      resolveId(id, importer) {
        // Replace node:events and events imports with browser-compatible polyfill
        if (id === 'node:events' || id === 'events') {
          return path.resolve(__dirname, "src/lib/events-polyfill.ts");
        }
        // Exclude server-only packages from browser bundle
        if (id === 'pg' || id.startsWith('pg/')) {
          return { id: 'pg', external: true };
        }
        return null;
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  optimizeDeps: {
    exclude: ['pg', 'pg-native', 'better-sqlite3']
  },
  assetsInclude: ['**/*.wasm'],
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
