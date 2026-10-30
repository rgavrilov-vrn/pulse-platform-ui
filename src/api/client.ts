import axios from 'axios';
import { v4 as uuid } from 'uuid';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: 15_000,
    headers: { Accept: 'application/json' },
});

api.interceptors.request.use((cfg) => {
    const token = localStorage.getItem('auth.token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    cfg.headers['X-Correlation-Id'] = uuid();
    return cfg;
});

api.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('auth.token');
            if (!window.location.pathname.startsWith('/login')) {
                window.location.assign('/login');
            }
        }
        return Promise.reject(err);
    },
);