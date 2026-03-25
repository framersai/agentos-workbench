import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '@/utils/idbStorage';
import { sqlStateStorage } from '@/lib/sqlStateStorage';

type LeftPanelKey = 'compose' | 'personas' | 'agency' | 'workflows' | 'evaluation' | 'planning' | 'memory' | 'voice';

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
      preferredLeftPanel: 'personas',
      dismissWelcomeTour: () => set({ welcomeTourDismissed: true, welcomeTourSnoozeUntil: null }),
      snoozeWelcomeTour: (hours = 24) => set({ welcomeTourSnoozeUntil: Date.now() + hours * 60 * 60 * 1000 }),
      setPreferredLeftPanel: (panel) => set({ preferredLeftPanel: panel }),
    }),
    { name: 'agentos-workbench-ui', storage: createJSONStorage(() => (typeof window !== 'undefined' ? idbStorage : sqlStateStorage)) }
  )
);

