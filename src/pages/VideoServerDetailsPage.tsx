import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { VideoPager, videoError, videoTime } from '../components/VideoServerWidgets';
import {
    listVideoEvents,
    listVideoCameras,
    listVideoChannels,
    type VideoEventParams,
    type VideoCameraParams,
    type VideoChannelParams
} from '../api/videoServers';
import { useAuthContext } from '../auth/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import './VideoServerDetailsPage.css';
import './VideoServerCollapse.css';

type BlockId = 'info' | 'cameras' | 'channels' | 'events';
const allOpen = () => ({ info: true, cameras: true, channels: true, events: true });

function BlockHeading({ id, title, expanded, onToggle, summary }: {
    id: string; title: string; expanded: boolean; onToggle: () => void; summary: ReactNode;
}) {
    return <div className="vsd-collapse-heading"><h2 id={`${id}-title`}>
        <button type="button" className="vsd-collapse-button" aria-expanded={expanded} aria-controls={`${id}-body`} onClick={onToggle}>
            <span>{title}</span><span className="vsd-collapse-summary">{summary}</span>
            <svg className={expanded ? 'vsd-chevron expanded' : 'vsd-chevron'} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
    </h2></div>;
}

// --- БЛОК КАМЕР ---
function CamerasBlock({ serverId, expanded, onToggle, onCameraSelect }: {
    serverId: string; expanded: boolean; onToggle: () => void; onCameraSelect: (id: string) => void;
}) {
    const { user } = useAuthContext();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [params, setParams] = useState<VideoCameraParams>({ videoServerId: serverId, page: 0, size: 10, sort: 'name,ASC' });

    useEffect(() => {
        setParams(p => ({ ...p, page: 0, q: debouncedSearch || undefined }));
    }, [debouncedSearch]);

    const query = useQuery({
        queryKey: ['video-server-cameras', user?.id, params],
        queryFn: ({ signal }) => listVideoCameras(params, signal),
        enabled: !!user && !!serverId && serverId !== 'demo',
        retry: false,
    });
    const data = query.isError ? undefined : query.data;

    return <section id="cameras" className="vsd-section" aria-labelledby="cameras-title">
        <BlockHeading id="cameras" title="Камеры" expanded={expanded} onToggle={onToggle} summary={data ? `${data.totalElements} · API` : 'загрузка...'} />
        <div id="cameras-body" hidden={!expanded}>
            <div className="vsd-tools">
                <label className="vsd-search">Поиск<input type="search" className="form-control" placeholder="Название, код или ID" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
                <button type="button" className="btn btn-outline-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
            </div>
            {query.isError && <div className="vms-error" role="alert">{videoError(query.error)}</div>}
            <div className="vsd-table-scroll" aria-busy={query.isFetching}>
                <table className="vsd-table">
                    <thead><tr>
                        <th scope="col">Название / Код</th><th scope="col">Состояние</th><th scope="col">Внешний ID</th><th scope="col">Действие</th>
                    </tr></thead>
                    <tbody>
                    {!data && !query.isError && <tr><td colSpan={4}>Загрузка…</td></tr>}
                    {data && !data.content.length && <tr><td colSpan={4}>Камеры не найдены.</td></tr>}
                    {data?.content.map((c) => (
                        <tr key={c.id}>
                            <td><strong>{c.name ?? 'Без названия'}</strong><small>{c.code ?? c.id}</small></td>
                            <td><span className={`vsd-badge ${c.status === 'ONLINE' ? 'good' : c.status === 'OFFLINE' ? 'bad' : 'warn'}`}>{c.status === 'ONLINE' ? 'В сети' : c.status === 'OFFLINE' ? 'Не в сети' : 'Неизвестно'}</span></td>
                            <td><code>{c.externalId ?? '—'}</code></td>
                            <td><button type="button" className="vsd-text-button" onClick={() => onCameraSelect(c.id)}>События камеры →</button></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <VideoPager data={data} size={params.size} fetching={query.isFetching} onPage={(page) => setParams(p => ({ ...p, page }))} onSize={(size) => setParams(p => ({ ...p, page: 0, size }))} />
        </div>
    </section>;
}

// --- БЛОК КАНАЛОВ ---
function ChannelsBlock({ serverId, expanded, onToggle }: {
    serverId: string; expanded: boolean; onToggle: () => void;
}) {
    const { user } = useAuthContext();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [params, setParams] = useState<VideoChannelParams>({ videoServerId: serverId, page: 0, size: 10, sort: 'name,ASC' });

    useEffect(() => {
        setParams(p => ({ ...p, page: 0, q: debouncedSearch || undefined }));
    }, [debouncedSearch]);

    const query = useQuery({
        queryKey: ['video-server-channels', user?.id, params],
        queryFn: ({ signal }) => listVideoChannels(params, signal),
        enabled: !!user && !!serverId && serverId !== 'demo',
        retry: false,
    });
    const data = query.isError ? undefined : query.data;

    return <section id="channels" className="vsd-section" aria-labelledby="channels-title">
        <BlockHeading id="channels" title="Каналы" expanded={expanded} onToggle={onToggle} summary={data ? `${data.totalElements} · API` : 'загрузка...'} />
        <div id="channels-body" hidden={!expanded}>
            <div className="vsd-tools">
                <label className="vsd-search">Поиск<input type="search" className="form-control" placeholder="Название или ID" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
                <button type="button" className="btn btn-outline-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
            </div>
            {query.isError && <div className="vms-error" role="alert">{videoError(query.error)}</div>}
            <div className="vsd-table-scroll" aria-busy={query.isFetching}>
                <table className="vsd-table">
                    <thead><tr>
                        <th scope="col">Название</th><th scope="col">Состояние</th><th scope="col">Внешний ID</th><th scope="col">ID Камеры</th>
                    </tr></thead>
                    <tbody>
                    {!data && !query.isError && <tr><td colSpan={4}>Загрузка…</td></tr>}
                    {data && !data.content.length && <tr><td colSpan={4}>Каналы не найдены.</td></tr>}
                    {data?.content.map((c) => (
                        <tr key={c.id}>
                            <td><strong>{c.name ?? 'Без названия'}</strong><small>{c.id}</small></td>
                            <td><span className={`vsd-badge ${c.status === 'ONLINE' ? 'good' : c.status === 'OFFLINE' ? 'bad' : 'warn'}`}>{c.status === 'ONLINE' ? 'Активен' : c.status === 'OFFLINE' ? 'Отключён' : 'Неизвестно'}</span></td>
                            <td><code>{c.externalId ?? '—'}</code></td>
                            <td><code>{c.cameraId ?? '—'}</code></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <VideoPager data={data} size={params.size} fetching={query.isFetching} onPage={(page) => setParams(p => ({ ...p, page }))} onSize={(size) => setParams(p => ({ ...p, page: 0, size }))} />
        </div>
    </section>;
}

// --- БЛОК СОБЫТИЙ ---
function EventsBlock({ serverId, expanded, onToggle, cameraId, onClearCamera }: {
    serverId: string; expanded: boolean; onToggle: () => void; cameraId: string; onClearCamera: () => void;
}) {
    const { user } = useAuthContext();
    const [params, setParams] = useState<VideoEventParams>({ videoServerId: serverId, page: 0, size: 10, sort: 'occurredAt,desc' });

    useEffect(() => {
        setParams(p => ({ ...p, page: 0, cameraId: cameraId || undefined }));
    }, [cameraId]);

    const query = useQuery({
        queryKey: ['video-server-events', user?.id, params],
        queryFn: ({ signal }) => listVideoEvents(params, signal),
        enabled: !!user && !!serverId && serverId !== 'demo',
        retry: false,
    });
    const data = query.isError ? undefined : query.data;

    return <section id="events" className="vsd-section" aria-labelledby="events-title">
        <BlockHeading id="events" title="События" expanded={expanded} onToggle={onToggle} summary={data ? `${data.totalElements} · API` : 'загрузка...'} />
        <div id="events-body" hidden={!expanded}>
            <div className="vsd-tools">
                {cameraId && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="subtle">Фильтр по камере: <code>{cameraId}</code></span>
                    <button type="button" className="vsd-text-button" onClick={onClearCamera}>Сбросить</button>
                </div>}
                <button type="button" className="btn btn-outline-secondary" style={{ marginLeft: 'auto' }} disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
            </div>
            {query.isError && <div className="vms-error" role="alert">{videoError(query.error)}</div>}
            <div className="vsd-table-scroll" aria-busy={query.isFetching}>
                <table className="vsd-table">
                    <thead><tr>
                        <th scope="col">Время (МСК)</th><th scope="col">Событие</th><th scope="col">Критичность</th><th scope="col">Камера</th><th scope="col">Источник</th>
                    </tr></thead>
                    <tbody>
                    {!data && !query.isError && <tr><td colSpan={5}>Загрузка…</td></tr>}
                    {data && !data.content.length && <tr><td colSpan={5}>События не найдены.</td></tr>}
                    {data?.content.map((e) => (
                        <tr key={e.eventId}>
                            <td><time dateTime={e.occurredAt}>{videoTime(e.occurredAt)}</time></td>
                            <td><strong>{e.eventType ?? 'Неизвестно'}</strong><small>{e.eventId}</small></td>
                            <td><span className={`vsd-badge ${e.severity === 'CRITICAL' ? 'bad' : e.severity === 'WARNING' ? 'warn' : 'good'}`}>{e.severity ?? '—'}</span></td>
                            <td><code>{e.cameraId ?? '—'}</code></td>
                            <td>{e.source ?? '—'}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <VideoPager data={data} size={params.size} fetching={query.isFetching} onPage={(page) => setParams(p => ({ ...p, page }))} onSize={(size) => setParams(p => ({ ...p, page: 0, size }))} />
        </div>
    </section>;
}

// --- ГЛАВНЫЙ КОМПОНЕНТ СТРАНИЦЫ ---
export function VideoServerDetailsPage() {
    const { serverId = 'demo' } = useParams();
    const location = useLocation();
    const navigation = location.state as { displayName?: string; registry?: unknown } | null;
    const name = navigation?.displayName || 'Видеосервер';

    const [cameraId, setCameraId] = useState('');
    const [expanded, setExpanded] = useState(allOpen);
    const [target, setTarget] = useState<'cameras' | 'channels' | 'events' | null>(null);

    useEffect(() => { setCameraId(''); setExpanded(allOpen()); setTarget(null); }, [serverId]);

    useEffect(() => {
        if (!target) return;
        const frame = requestAnimationFrame(() => {
            document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTarget(null);
        });
        return () => cancelAnimationFrame(frame);
    }, [target]);

    function toggle(id: BlockId) { setExpanded((value) => ({ ...value, [id]: !value[id] })); }
    function goTo(id: 'cameras' | 'channels' | 'events') { setExpanded((value) => ({ ...value, [id]: true })); setTarget(id); }
    function showCamera(id: string) { setCameraId(id); goTo('events'); }

    async function copyId() {
        try { await navigator.clipboard.writeText(serverId); toast.success('ID скопирован'); }
        catch { toast.error('Не удалось скопировать.'); }
    }

    return <><Header /><div className="app-body vsd-app"><Sidebar /><main className="workspace vsd-workspace" data-info-collapsed={!expanded.info}>
        <div className="page-heading">
            <div>
                <div className="breadcrumb-line"><Link to="/video-servers" state={{ registry: navigation?.registry }}>Видеосерверы</Link><span>/</span>Карточка сервера</div>
                <h1>{name}</h1>
            </div>
            <Link className="btn btn-outline-secondary" to="/video-servers" state={{ registry: navigation?.registry }}>← К реестру</Link>
        </div>

        <section id="info" className="vsd-section vsd-info" aria-labelledby="info-title">
            <BlockHeading id="info" title="Информация о сервере" expanded={expanded.info} onToggle={() => toggle('info')} summary={<span className="vsd-badge good">API</span>} />
            <div id="info-body" hidden={!expanded.info}>
                <dl className="vsd-info-grid">
                    <div><dt>ID из ссылки</dt><dd className="vsd-id">{serverId} <button type="button" className="vsd-text-button" onClick={() => void copyId()}>Копировать</button></dd></div>
                </dl>
                <div className="vsd-metrics">
                    <a href="#cameras" onClick={(e) => { e.preventDefault(); goTo('cameras'); }}><strong>API</strong><span>Камеры</span></a>
                    <a href="#channels" onClick={(e) => { e.preventDefault(); goTo('channels'); }}><strong>API</strong><span>Каналы</span></a>
                    <a href="#events" onClick={(e) => { e.preventDefault(); goTo('events'); }}><strong>API</strong><span>События</span></a>
                </div>
            </div>
        </section>

        <nav className="vsd-anchor-nav" aria-label="Блоки карточки">
            <a href="#cameras" onClick={(e) => { e.preventDefault(); goTo('cameras'); }}>Камеры</a>
            <a href="#channels" onClick={(e) => { e.preventDefault(); goTo('channels'); }}>Каналы</a>
            <a href="#events" onClick={(e) => { e.preventDefault(); goTo('events'); }}>События</a>
        </nav>

        {/* Подключаем реальные компоненты, если это не демо-режим */}
        {serverId !== 'demo' ? (
            <>
                <CamerasBlock serverId={serverId} expanded={expanded.cameras} onToggle={() => toggle('cameras')} onCameraSelect={showCamera} />
                <ChannelsBlock serverId={serverId} expanded={expanded.channels} onToggle={() => toggle('channels')} />
                <EventsBlock serverId={serverId} expanded={expanded.events} onToggle={() => toggle('events')} cameraId={cameraId} onClearCamera={() => setCameraId('')} />
            </>
        ) : (
            <div className="vsd-demo" role="note">Вы открыли демонстрационную карточку. Выберите реальный сервер в реестре, чтобы увидеть данные из API.</div>
        )}
    </main></div></>;
}