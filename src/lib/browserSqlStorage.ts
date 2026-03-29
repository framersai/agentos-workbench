import type { StorageAdapter } from "@framers/sql-storage-adapter/types";
import { IndexedDbAdapter, type IndexedDbAdapterOptions } from "@framers/sql-storage-adapter";

function locateSqlJsFile(file: string): string {
  if (file.endsWith(".wasm")) {
    return "/sql-wasm.wasm";
  }
  return file;
}

export interface BrowserSqlStorageOptions extends Omit<IndexedDbAdapterOptions, "sqlJsConfig"> {
  sqlJsConfig?: IndexedDbAdapterOptions["sqlJsConfig"];
}

export function createBrowserSqlStorageAdapter(options: BrowserSqlStorageOptions = {}): StorageAdapter {
  const sqlJsConfig =
    options.sqlJsConfig && typeof options.sqlJsConfig === "object"
      ? (options.sqlJsConfig as Record<string, unknown>)
      : {};

  return new IndexedDbAdapter({
    autoSave: true,
    ...options,
    sqlJsConfig: {
      ...sqlJsConfig,
      locateFile: locateSqlJsFile
    }
  });
}
