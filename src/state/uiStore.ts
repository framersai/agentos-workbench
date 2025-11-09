import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '@/utils/idbStorage';

interface UiState {
  welcomeTourDismissed: boolean;
  welcomeTourSnoozeUntil: number | null;
  dismissWelcomeTour: () => void;
  snoozeWelcomeTour: (hours?: number) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      welcomeTourDismissed: false,
      welcomeTourSnoozeUntil: null,
      dismissWelcomeTour: () => set({ welcomeTourDismissed: true, welcomeTourSnoozeUntil: null }),
      snoozeWelcomeTour: (hours = 24) => set({ welcomeTourSnoozeUntil: Date.now() + hours * 60 * 60 * 1000 }),
    }),
    { name: 'agentos-client-ui', storage: createJSONStorage(() => idbStorage as Storage) }
  )
);


