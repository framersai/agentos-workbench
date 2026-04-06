import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

const backendPort = process.env.VITE_BACKEND_PORT || process.env.AGENTOS_WORKBENCH_BACKEND_PORT || "3001";
const backendHost = process.env.VITE_BACKEND_HOST || "localhost";
const backendProtocol = process.env.VITE_BACKEND_PROTOCOL || "http";
const backendTarget = process.env.VITE_API_URL || `${backendProtocol}://${backendHost}:${backendPort}`;

function packageChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  const matchesPackage = (specifier: string): boolean => {
    const pnpmName = specifier.replace("/", "+");
    return (
      id.includes(`/node_modules/${specifier}/`) ||
      id.includes(`/${pnpmName}@`) ||
      id.includes(`\\node_modules\\${specifier}\\`)
    );
  };

  const groups: Array<{ chunk: string; packages?: string[]; fragments?: string[] }> = [
    { chunk: "vendor-router", packages: ["react-router", "react-router-dom"] },
    { chunk: "vendor-icons", packages: ["lucide-react"] },
    { chunk: "vendor-state", packages: ["zustand", "@tanstack/react-query"] },
    { chunk: "vendor-i18n", packages: ["i18next", "react-i18next", "i18next-browser-languagedetector"] },
    { chunk: "vendor-forms", packages: ["react-hook-form", "@hookform/resolvers", "zod"] },
    {
      chunk: "vendor-markdown",
      packages: ["react-markdown"],
      fragments: ["remark-", "rehype-", "micromark", "mdast-util-", "unist-util-"],
    },
    {
      chunk: "vendor-polyfills",
      packages: [
        "vite-plugin-node-polyfills",
        "readable-stream",
        "elliptic",
        "bn.js",
        "asn1.js",
        "parse-asn1",
        "crypto-browserify",
        "browserify-aes",
        "browserify-cipher",
        "browserify-des",
        "browserify-rsa",
        "browserify-sign",
        "create-ecdh",
        "create-hash",
        "create-hmac",
        "diffie-hellman",
        "public-encrypt",
        "pbkdf2",
        "ripemd160",
        "sha.js",
        "hash.js",
        "md5.js",
        "cipher-base",
        "des.js",
        "stream-browserify",
        "string_decoder",
        "events",
        "util",
      ],
      fragments: ["browserify-", "create-", "randomfill", "process-nextick-args"],
    },
    { chunk: "vendor-socket", packages: ["socket.io-client", "engine.io-client", "socket.io-parser", "engine.io-parser"] },
    { chunk: "vendor-storage", packages: ["sql.js", "idb", "vm-browserify"] },
    { chunk: "vendor-react", packages: ["react", "react-dom", "scheduler"] },
    { chunk: "vendor-theme", packages: ["@framers/theme-tokens"] },
    { chunk: "vendor-agentos", packages: ["@framers/agentos"] },
  ];

  for (const group of groups) {
    if (
      group.packages?.some(matchesPackage) ||
      group.fragments?.some((fragment) => id.includes(fragment))
    ) {
      return group.chunk;
    }
  }

  return "vendor";
}

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
      "@": path.resolve(__dirname, "src"),
      "@framers/sql-storage-adapter/adapters/indexedDbAdapter": path.resolve(
        __dirname,
        "../../packages/sql-storage-adapter/src/adapters/indexedDbAdapter.ts"
      ),
      // Use workspace source for browser-safe build and avoid package exports resolution
      // "@framers/sql-storage-adapter": path.resolve(__dirname, "../../packages/sql-storage-adapter/src/index.ts")
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return packageChunk(id);
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['pg', 'pg-native', 'better-sqlite3']
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    host: process.env.VITE_DEV_HOST || (process.env.VITE_E2E_MODE === 'true' ? true : undefined),
    port: 5175,
    open: process.env.VITE_E2E_MODE === 'true' ? false : true,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        secure: false
      }
    }
  }
});
