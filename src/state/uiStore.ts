import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '@/utils/idbStorage';
import { sqlStateStorage } from '@/lib/sqlStateStorage';

type LeftPanelKey =
  | 'home'
  | 'playground'
  | 'prompt-workspace'
  | 'compose'
  | 'personas'
  | 'agency'
  | 'workflows'
  | 'evaluation'
  | 'planning'
  | 'memory'
  | 'voice'
  | 'strategy'
  | 'resources'
  | 'schema'
  | 'rag'
  | 'hitl'
  | 'capabilities'
  | 'graph-builder'
  | 'tool-forge'
  | 'channels'
  | 'social'
  | 'call-monitor'
  | 'guardrail-eval'
  | 'observability'
  | 'rag-docs';

interface UiState {
  welcomeTourDismissed: boolean;
  welcomeTourSnoozeUntil: number | null;
  dismissWelcomeTour: () => void;
  snoozeWelcomeTour: (hours?: number) => void;
  preferredLeftPanel: LeftPanelKey;
  setPreferredLeftPanel: (panel: LeftPanelKey) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      welcomeTourDismissed: false,
      welcomeTourSnoozeUntil: null,
      preferredLeftPanel: 'home',
      dismissWelcomeTour: () => set({ welcomeTourDismissed: true, welcomeTourSnoozeUntil: null }),
      snoozeWelcomeTour: (hours = 24) => set({ welcomeTourSnoozeUntil: Date.now() + hours * 60 * 60 * 1000 }),
      setPreferredLeftPanel: (panel) => set({ preferredLeftPanel: panel }),
    }),
    { name: 'agentos-workbench-ui', storage: createJSONStorage(() => (typeof window !== 'undefined' ? idbStorage : sqlStateStorage)) }
  )
);

