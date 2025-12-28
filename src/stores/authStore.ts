import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth as authApi, getToken, setToken } from '@/services/api';
import type { User, AuthState } from '@/types';

interface AuthStore extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: getToken(),
      isAuthenticated: !!getToken(),

      login: async (username: string, password: string) => {
        const data = await authApi.login(username, password);
        set({
          user: data.user || { id: 'admin', username, role: 'admin' },
          token: data.access_token,
          isAuthenticated: true,
        });
      },

      register: async (username: string, password: string) => {
        await authApi.register(username, password);
        // After registration, login automatically
        await get().login(username, password);
      },

      logout: () => {
        authApi.logout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      checkAuth: () => {
        const token = getToken();
        if (token) {
          set({ token, isAuthenticated: true });
        } else {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'warebot-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
