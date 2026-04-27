import { create } from 'zustand';
import api from '../utils/api.js';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('sf_user') || 'null'),
  token: localStorage.getItem('sf_token'),
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const data = await api.post('/auth/login', { email, password });
      localStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });
      return data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    set({ user: null, token: null });
  },

  isAdmin: () => get().user?.role === 'admin',
  isInventoryManager: () => ['admin', 'inventory_manager'].includes(get().user?.role),
  isSalesperson: () => get().user?.role === 'salesperson',
}));
