import { useEffect, useState } from 'react';
import { useAuthContext } from '../auth/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
export function Header() {
    const { user, logout } = useAuthContext();
    const { mode, toggle } = useTheme();
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const initials = (user?.displayName ?? 'U').slice(0, 2).toUpperCase();

    return (
        <header className="app-header">
            <a className="brand" href="/" aria-label="АРМ Оператора">
                <img className="logo-light" src="/assets/logo.svg" alt="AGROECO tech" />
                <img className="logo-dark" src="/assets/logo-white.svg" alt="AGROECO tech" />
            </a>
            <div className="app-name">
                <span className="eyebrow">Ситуационный центр</span>
                <strong>Рабочее место оператора</strong>
            </div>
            <div className="header-right">
                <div className="clock">
                    <strong>{format(now, 'HH:mm:ss')}</strong>
                    <span>{format(now, 'd MMMM, EEE', { locale: ru })} · МСК</span>
                </div>
                <button
                    className="icon-btn"
                    onClick={toggle}
                    title="Сменить тему"
                    aria-label="Сменить тему"
                >
                    {mode === 'dark' ? '☀' : '☾'}
                </button>
                <span className="header-divider" />
                <div className="avatar">{initials}</div>
                <div className="user-name">
                    <strong>{user?.displayName ?? 'Гость'}</strong>
                    <span onClick={logout} style={{ cursor: 'pointer' }}>
            Выйти
          </span>
                </div>
            </div>
        </header>
    );
}