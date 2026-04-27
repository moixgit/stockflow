import { create } from 'zustand';

const stored = localStorage.getItem('sf-theme') || 'dark';
document.documentElement.classList.toggle('dark', stored === 'dark');

export const useThemeStore = create((set) => ({
  theme: stored,
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      localStorage.setItem('sf-theme', next);
      return { theme: next };
    }),
}));
