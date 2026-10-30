import { useCallback, useMemo, useState } from 'react';
import { authApi, decodeJwt } from '../api/auth';
import type { UserInfo } from '../api/types';

const TOKEN_KEY = 'auth.token';

function readInitial(): UserInfo | null {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? decodeJwt(token) : null;
}

export function useAuth() {
    const [user, setUser] = useState<UserInfo | null>(readInitial);

    const login = useCallback(async (username: string, password: string) => {
        const { accessToken } = await authApi.login(username, password);
        localStorage.setItem(TOKEN_KEY, accessToken);
        setUser(decodeJwt(accessToken));
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
    }, []);

    const hasAuthority = useCallback(
        (code: string) => {
            if (!user) return false;
            if (user.roles.includes('ROLE_SUPERUSER')) return true;
            return user.roles.includes(code);
        },
        [user],
    );

    return useMemo(
        () => ({ user, login, logout, hasAuthority }),
        [user, login, logout, hasAuthority],
    );
}