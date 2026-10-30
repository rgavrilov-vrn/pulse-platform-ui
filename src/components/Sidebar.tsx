import { NavLink } from 'react-router-dom';
import type { CSSProperties } from 'react';

const linkStyle: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 4,
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
            <NavLink to="/audit" title="Аудит" aria-label="Аудит"
                className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={linkStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg><span>Аудит</span>
            </NavLink>
            <NavLink to="/video-servers" title="Видеосерверы" aria-label="Видеосерверы"
                className={({ isActive }) => `rail-btn${isActive ? ' active' : ''}`} style={{ ...linkStyle, height: 64, minHeight: 64 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" />
                    <path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6" strokeLinecap="round" />
                </svg><span style={{ textAlign: 'center', fontSize: 8 }}>Видео<br />серверы</span>
            </NavLink>
        </nav>
    );
}
