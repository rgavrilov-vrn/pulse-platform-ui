import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../auth/AuthContext';

export function LoginPage() {
    const { login } = useAuthContext();
    const nav = useNavigate();
    const [username, setUsername] = useState('operator');
    const [password, setPassword] = useState('operator');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login(username, password);
            nav('/');
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Неверный логин или пароль');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-header" style={{ height: 'auto', padding: '4rem' }}>
            <div className="panel" style={{ padding: '2rem', width: 360, margin: '0 auto' }}>
                <h2>Вход в АРМ</h2>
                <form onSubmit={onSubmit}>
                    <div className="field-block">
                        <label>Логин</label>
                        <input
                            className="form-control"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                        />
                    </div>
                    <div className="field-block">
                        <label>Пароль</label>
                        <input
                            className="form-control"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>
                    {error && <div className="invalid-feedback d-block">{error}</div>}
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={loading}>
                        {loading ? 'Вход…' : 'Войти'}
                    </button>
                </form>
            </div>
        </div>
    );
}