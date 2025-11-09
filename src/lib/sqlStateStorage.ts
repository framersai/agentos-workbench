import { createDatabase, type StorageAdapter } from "@framers/sql-storage-adapter";
import type { StateStorage } from "zustand/middleware";

/**
 * Key/value table name used for storing persisted Zustand slices.
 */
const TABLE_NAME = "agentos_state_blobs";

let adapterPromise: Promise<StorageAdapter> | null = null;
let schemaPromise: Promise<void> | null = null;

/**
 * Lazily creates (or reuses) a SQL adapter backed by IndexedDB/sql.js in browsers.
 */
async function getAdapter(): Promise<StorageAdapter> {
  if (!adapterPromise) {
    adapterPromise = createDatabase({
      priority: ["indexeddb", "sqljs", "memory"],
      type: typeof window === "undefined" ? "memory" : undefined
    });
  }
  const adapter = await adapterPromise;

  if (!schemaPromise) {
    schemaPromise = adapter.exec?.(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `) ?? Promise.resolve();
  }
  await schemaPromise;
  return adapter;
}

const memoryStore = new Map<string, string>();

const memoryStorage: StateStorage = {
  getItem: (name) => memoryStore.get(name) ?? null,
  setItem: (name, value) => {
    memoryStore.set(name, value);
  },
  removeItem: (name) => {
    memoryStore.delete(name);
  }
};

const isBrowser = typeof window !== "undefined";

/**
 * Storage adapter backed by the SQL storage adapter (IndexedDB/sql.js in browsers).
 * Falls back to in-memory storage for SSR/test environments or when the SQL adapter fails.
 */
export const sqlStateStorage: StateStorage = isBrowser
  ? {
      getItem: async (name) => {
        try {
          const adapter = await getAdapter();
          const row = await adapter.get<{ value: string }>(`SELECT value FROM ${TABLE_NAME} WHERE key = ?`, [name]);
          return row?.value ?? null;
        } catch (error) {
          console.warn("[AgentOS Client] SQL state storage getItem failed. Falling back to memory.", error);
          return memoryStorage.getItem(name);
        }
      },
      setItem: async (name, value) => {
        try {
          const adapter = await getAdapter();
          await adapter.run(
            `INSERT INTO ${TABLE_NAME} (key, value, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [name, value, new Date().toISOString()]
          );
        } catch (error) {
          console.warn("[AgentOS Client] SQL state storage setItem failed. Falling back to memory.", error);
          memoryStorage.setItem(name, value);
        }
      },
      removeItem: async (name) => {
        try {
          const adapter = await getAdapter();
          await adapter.run(`DELETE FROM ${TABLE_NAME} WHERE key = ?`, [name]);
        } catch (error) {
          console.warn("[AgentOS Client] SQL state storage removeItem failed. Falling back to memory.", error);
          memoryStorage.removeItem(name);
        }
      }
    }
  : memoryStorage;
