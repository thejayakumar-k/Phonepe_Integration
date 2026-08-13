import { createContext, useContext, useState, type ReactNode } from 'react';

export type Role = 'vendor' | 'customer';

export interface Session {
  role: Role;
  username: string;
  vendorId?: string;
  vendorName?: string;
  customerId?: string;
  customerName?: string;
}

interface AuthContextValue {
  session: Session | null;
  login: (session: Session) => void;
  logout: () => void;
}

const STORAGE_KEY = 'oorunii_session';

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): Session | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  const login = (next: Session) => {
    setSession(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
