import { useSyncExternalStore } from 'react';

import {
  getAuthSnapshot,
  subscribeAuth,
  login,
  logout,
  retrySession,
} from '../services/auth.js';

export function useAuth() {
  const state = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
  );

  return {
    ...state,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    login,
    logout,
    retrySession,
  };
}