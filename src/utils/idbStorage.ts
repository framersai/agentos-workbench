/**
 * IndexedDB-backed key/value storage used by the AgentOS client for local persistence.
 *
 * Notes:
 * - Data is stored entirely in the browser (no server writes).
 * - Used by Zustand's persist layer via a minimal Storage-like interface.
 */
const DB_NAME = 'agentosClientDB';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    Promise.resolve(fn(store))
      .then((result) => {
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      })
      .catch(reject);
  });
}

export const idbStorage = {
  /** Reads a value by key. Returns null when not found. */
  async getItem(key: string): Promise<string | null> {
    return withStore('readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as string) ?? null);
        req.onerror = () => reject(req.error);
      });
    });
  },
  /** Writes a value by key. */
  async setItem(key: string, value: string): Promise<void> {
    return withStore('readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
  /** Removes a value by key. */
  async removeItem(key: string): Promise<void> {
    return withStore('readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
  /** Clears the entire store (all client data). */
  async clearAll(): Promise<void> {
    return withStore('readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
};


