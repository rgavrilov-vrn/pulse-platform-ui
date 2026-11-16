import { NavLink } from 'react-router-dom';
import type { CSSProperties } from 'react';

const linkStyle: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 4,
    alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    height: 54, minHeight: 54, padding: '6px 2px',
    textDecoration: 'none', fontSize: 9, lineHeight: 1.2,
};

export function Sidebar() {
    return (
        <nav className="rail" aria-label="Разделы" style={{ gap: 8 }}>
            <NavLink to="/" end title="Реестр событий" aria-label="Реестр событий"
                     className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={linkStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
                </svg><span>События</span>
            </NavLink>
            <NavLink to="/audit" end title="Журнал аудита" aria-label="Журнал аудита"
                     className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={{ ...linkStyle, height: 64, minHeight: 64 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg><span style={{ textAlign: 'center', fontSize: 8 }}>Журнал<br />аудита</span>
            </NavLink>
            <NavLink to="/reports/objects" title="Отчёты по объектам" aria-label="Отчёты по объектам"
                     className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={linkStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 3h12l4 4v14H4zM8 11h8M8 15h8M8 7h3" strokeLinecap="round" strokeLinejoin="round" /></svg><span>Отчёты</span>
            </NavLink>
            <NavLink to="/catalog" title="Категории и контрольные точки" aria-label="Категории и контрольные точки"
                     className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={linkStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeLinejoin="round" /></svg><span>Справочники</span>
            </NavLink>
            <NavLink to="/video-servers" title="Видеосерверы" aria-label="Видеосерверы"
                     className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={{ ...linkStyle, height: 64, minHeight: 64 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" />
                    <path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6" strokeLinecap="round" />
                </svg><span style={{ textAlign: 'center', fontSize: 8 }}>Видео<br />серверы</span>
            </NavLink>

            <NavLink to="/trassir/events" title="События TRASSIR" aria-label="События TRASSIR"
                     className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={{ ...linkStyle, height: 64, minHeight: 64 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round"/>
                    <path d="M12 8v4m0 4h.01" strokeLinecap="round"/>
                </svg><span style={{ textAlign: 'center', fontSize: 8 }}>События<br />TRASSIR</span>
            </NavLink>
            <NavLink to="/trassir/audit" title="Аудит TRASSIR" aria-label="Аудит TRASSIR"
                     className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={{ ...linkStyle, height: 64, minHeight: 64 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg><span style={{ textAlign: 'center', fontSize: 8 }}>Аудит<br />TRASSIR</span>
            </NavLink>

            <NavLink to="/trassir/ingest-log" title="Журнал запросов Ingest" aria-label="Журнал запросов Ingest"
                     className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={{ ...linkStyle, height: 64, minHeight: 64 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg><span style={{ textAlign: 'center', fontSize: 8 }}>Журнал<br />Ingest</span>
            </NavLink>
        </nav>
    );
}
