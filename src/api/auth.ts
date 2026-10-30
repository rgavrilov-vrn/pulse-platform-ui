import { api } from './client';
import type { UserInfo } from './types';

interface TokenResponse {
    accessToken: string;
    tokenType: string;
    expiresInSeconds: number;
}

export const authApi = {
    login: (username: string, password: string) =>
        api
            .post<TokenResponse>('/api/v1/auth/token', { username, password })
            .then((r) => r.data),
};

/** Декодирует payload JWT (без проверки подписи — только для UI). */
export function decodeJwt(token: string): UserInfo | null {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
            id: payload.uid ?? payload.sub,
            login: payload.sub,
            displayName: payload.displayName ?? payload.sub,
            roles: payload.roles ?? [],
        };
    } catch {
        return null;
    }
}