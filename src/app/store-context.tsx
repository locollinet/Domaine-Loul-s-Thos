import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Command, CommandResult } from '../domain/commands/types';
import { DomainError } from '../domain/errors';
import type { DomainState, RoleId } from '../domain/types';
import { localDb } from '../infra/db';

export interface StoreContextValue {
  state: DomainState | null;
  role: RoleId;
  setRole: (role: RoleId) => void;
  dispatch: (command: Command) => Promise<CommandResult>;
  resetDemo: () => Promise<void>;
  feedback: { type: 'success' | 'error'; message: string } | null;
  clearFeedback: () => void;
  isReady: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DomainState | null>(null);
  const [role, setRole] = useState<RoleId>('cellar_master');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    localDb.loadOrCreateState()
      .then((s) => {
        setState(s);
        setIsReady(true);
      })
      .catch((err) => {
        console.error('Failed to load state from IndexedDB:', err);
        setFeedback({ type: 'error', message: 'Erreur lors du chargement des données locales.' });
      });
  }, []);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const dispatch = useCallback(async (command: Command): Promise<CommandResult> => {
    if (!state) throw new Error('Store not ready');
    const clock = state.referenceDate;
    const idempotencyKey = `ui-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const { state: nextState, result } = await localDb.executeCommand(
        { idempotencyKey, actor: role, command },
        clock
      );
      setState(nextState);
      setFeedback({ type: 'success', message: result.message });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof DomainError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Erreur inattendue';
      setFeedback({ type: 'error', message: msg });
      throw err;
    }
  }, [state, role]);

  const resetDemo = useCallback(async () => {
    try {
      const fresh = await localDb.resetToSeed();
      setState(fresh);
      setFeedback({ type: 'success', message: 'Démo réinitialisée à l’état initial (seed v1).' });
    } catch {
      setFeedback({ type: 'error', message: 'Erreur lors de la réinitialisation de la démo.' });
    }
  }, []);

  return (
    <StoreContext.Provider value={{
      state,
      role,
      setRole,
      dispatch,
      resetDemo,
      feedback,
      clearFeedback,
      isReady,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
