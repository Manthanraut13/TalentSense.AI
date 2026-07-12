import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'resume_analyzer_session_id';

type SessionContextValue = {
  sessionId: string;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function getOrCreateSessionId() {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const sessionId = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, sessionId);
  return sessionId;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ sessionId: getOrCreateSessionId() }), []);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return value;
}