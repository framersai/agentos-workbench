import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secretDefinitionMap } from "@/lib/secretCatalog";
import { sqlStateStorage } from "@/lib/sqlStateStorage";

export interface SecretEntry {
  id: string;
  value: string;
  label?: string;
  updatedAt: string;
}

interface SecretState {
  secrets: Record<string, SecretEntry>;
  upsertSecret: (id: string, value: string) => void;
  removeSecret: (id: string) => void;
  getSecretValue: (id: string) => string | undefined;
}

export const useSecretStore = create<SecretState>()(
  persist(
    (set, get) => ({
      secrets: {},
      upsertSecret: (id, value) =>
        set((state) => {
          const definition = secretDefinitionMap.get(id);
          const entry: SecretEntry = {
            id,
            value,
            label: definition?.label ?? id,
            updatedAt: new Date().toISOString()
          };
          return { secrets: { ...state.secrets, [id]: entry } };
        }),
      removeSecret: (id) =>
        set((state) => {
          if (!state.secrets[id]) return state;
          const next = { ...state.secrets };
          delete next[id];
          return { secrets: next };
        }),
      getSecretValue: (id) => get().secrets[id]?.value
    }),
    {
      name: "agentos-client-secrets",
      storage: createJSONStorage(() => sqlStateStorage),
      partialize: (state) => ({
        secrets: state.secrets
      })
    }
  )
);
