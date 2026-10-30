import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from './useAuth';

type AuthValue = ReturnType<typeof useAuth>;
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const value = useAuth();
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthContext() {
    const v = useContext(Ctx);
    if (!v) throw new Error('AuthProvider missing');
    return v;
}