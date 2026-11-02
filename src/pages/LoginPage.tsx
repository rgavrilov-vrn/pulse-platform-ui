import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../auth/AuthContext';

export function LoginPage() {
    const { login } = useAuthContext();
    const nav = useNavigate();
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('admin');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login(username, password);
            nav('/');
        } catch (cause: any) {
            setError(cause.response?.data?.message ?? 'Неверный логин или пароль');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-backdrop" aria-hidden="true" />
            <main className="login-card" aria-labelledby="login-title">
                <div className="login-brand">
                    <span className="login-brand-mark" aria-hidden="true">P</span>
                    <div>
                        <span className="login-overline">PULSE PLATFORM</span>
                        <h1 id="login-title">Вход в АРМ</h1>
                    </div>
                </div>
                <p className="login-subtitle">
                    Введите учётные данные для доступа к рабочему месту оператора.
                </p>
                <form onSubmit={onSubmit} noValidate>
                    <div className="field-block">
                        <label htmlFor="login-username">Логин</label>
                        <input
                            id="login-username"
                            className="form-control"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            autoComplete="username"
                            autoFocus
                            required
                        />
                    </div>
                    <div className="field-block">
                        <label htmlFor="login-password">Пароль</label>
                        <input
                            id="login-password"
                            className="form-control"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </div>
                    {error && (
                        <div className="login-error" role="alert">
                            {error}
                        </div>
                    )}
                    <button className="btn btn-primary login-submit" type="submit" disabled={loading || !username.trim() || !password}>
                        {loading ? 'Вход…' : 'Войти'}
                    </button>
                </form>
                <p className="login-hint">Демо-доступ: admin / admin</p>
            </main>
        </div>
    );
}
