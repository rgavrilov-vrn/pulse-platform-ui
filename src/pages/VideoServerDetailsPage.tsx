import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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

// --- Типы и мок-данные для телеметрии ---
interface ServerTelemetry {
    startup_ts: string; server_ok: number; cpu_usage: number; gpu_usage: number;
    db_connected: number; db_is_slow: number; db_last_error: string;
    scripts_ok: number; scripts_total: number;
    disks_error_count: number; disks_is_slow: number; disks_last_error: string;
    disks_stat_main_days: number; disks_stat_subs_days: number;
    ip_devices_total: number; ip_devices_connected: number;
    channels_network_total: number; channels_network_online: number;
    network_should_be_connected: number; network_really_connected: number; network_last_error: string;
}

const mockTelemetry: ServerTelemetry = {
    startup_ts: "1794216598363702", server_ok: 1, cpu_usage: 6.25, gpu_usage: -1.0,
    db_connected: 1, db_is_slow: 0, db_last_error: "",
    scripts_ok: 9, scripts_total: 9,
    disks_error_count: 0, disks_is_slow: 0, disks_last_error: "",
    disks_stat_main_days: 90.03, disks_stat_subs_days: 0.0,
    ip_devices_total: 82, ip_devices_connected: 81,
    channels_network_total: 82, channels_network_online: 82,
    network_should_be_connected: 0, network_really_connected: 0, network_last_error: ""
};

function formatUptime(usec: string) {
    const ms = Number(usec) / 1000;
    const date = new Date(ms);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return `${days} д. ${hours} ч.`;
}

// --- Компонент живого графика ---
interface HealthPoint { time: number; value: number; }

type ChartRange = '1d' | '3d' | '5d' | '7d' | '10d' | '30d';
const RANGE_DAYS: Record<ChartRange, number> = {
    '1d': 1, '3d': 3, '5d': 5, '7d': 7, '10d': 10, '30d': 30
};

function HealthChart() {
    const generateInitialData = (): HealthPoint[] => {
        const points: HealthPoint[] = [];
        const now = Date.now();
        let currentValue = 15;

        for (let i = 8639; i >= 0; i--) {
            currentValue = Math.max(5, Math.min(95, currentValue + (Math.random() - 0.5) * 12));
            points.push({ time: now - i * 5 * 60 * 1000, value: currentValue });
        }
        return points;
    };

    const [data, setData] = useState<HealthPoint[]>(generateInitialData);
    const [range, setRange] = useState<ChartRange>('1d');
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setData(prev => {
                const lastValue = prev[prev.length - 1].value;
                const newValue = Math.max(5, Math.min(95, lastValue + (Math.random() - 0.5) * 12));
                return [...prev.slice(1), { time: Date.now(), value: newValue }];
            });
        }, 5 * 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    const filteredData = useMemo(() => {
        const pointsCount = RANGE_DAYS[range] * 24 * 12;
        return data.slice(-pointsCount);
    }, [data, range]);

    const width = 1000;
    const height = 150;

    const pointsPath = filteredData.map((p, i) => {
        const x = (i / (filteredData.length - 1)) * width;
        const y = height - (p.value / 100) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const areaPath = `${pointsPath} L ${width} ${height} L 0 ${height} Z`;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const idx = Math.round(pct * (filteredData.length - 1));
        setHoverIndex(idx);
    };

    const handleMouseLeave = () => setHoverIndex(null);

    const hoveredPoint = hoverIndex !== null ? filteredData[hoverIndex] : null;
    const hoverX = hoverIndex !== null ? (hoverIndex / (filteredData.length - 1)) * 100 : 0;

    const formatHoverTime = (ts: number) => {
        const d = new Date(ts);
        if (range === '1d') return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const getStartLabel = () => {
        if (range === '1d') return '24 ч. назад';
        const days = RANGE_DAYS[range];
        const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    return (
        <div className="vsd-chart-container">
            <div className="vsd-chart-header">
                <div>
                    <span>Нагрузка</span>
                    <div className="vsd-chart-ranges">
                        {(['1d', '3d', '5d', '7d', '10d', '30d'] as ChartRange[]).map(r => (
                            <button
                                key={r}
                                className={`vsd-range-btn ${range === r ? 'active' : ''}`}
                                onClick={() => { setRange(r); setHoverIndex(null); }}
                            >
                                {RANGE_DAYS[r]} дн.
                            </button>
                        ))}
                    </div>
                </div>
                <div className="vsd-chart-current">
                    Текущая: <strong>{data[data.length - 1]?.value.toFixed(1) || 0}%</strong>
                </div>
            </div>

            <div className="vsd-chart-wrapper">
                <div className="vsd-chart-y-axis">
                    <span>100%</span>
                    <span>50%</span>
                    <span>0%</span>
                </div>

                <div
                    className="vsd-chart-svg-container"
                    ref={chartRef}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                            </linearGradient>
                        </defs>
                        <path d={areaPath} fill="url(#chartGradient)" />
                        <path d={pointsPath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
                    </svg>

                    {hoveredPoint && (
                        <>
                            <div className="vsd-chart-crosshair" style={{ left: `${hoverX}%` }} />
                            <div className="vsd-chart-tooltip" style={{ left: `${hoverX}%` }}>
                                <div className="vsd-tooltip-time">
                                    {formatHoverTime(hoveredPoint.time)}
                                </div>
                                <div className="vsd-tooltip-val">{hoveredPoint.value.toFixed(1)}%</div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="vsd-chart-x-axis">
                <span>{getStartLabel()}</span>
                <span>Сейчас</span>
            </div>
        </div>
    );
}

// --- Вкладка: Детали ---
function TechDetailsTab({ t }: { t: ServerTelemetry }) {
    return (
        <div className="vsd-tech-grid">
            <div className="vsd-tech-card">
                <h3>Нагрузка</h3>
                <div className="vsd-tech-row">
                    <span>CPU</span>
                    <strong className={t.cpu_usage > 80 ? 'text-danger' : ''}>{t.cpu_usage}%</strong>
                </div>
                <div className="vsd-tech-row">
                    <span>GPU</span>
                    <strong>{t.gpu_usage === -1 ? 'N/A' : `${t.gpu_usage}%`}</strong>
                </div>
            </div>

            <div className="vsd-tech-card">
                <h3>База данных</h3>
                <div className="vsd-tech-row">
                    <span>Статус</span>
                    <span className={`vsd-badge ${t.db_connected ? 'good' : 'bad'}`}>
                        {t.db_connected ? 'Подключена' : 'Отключена'}
                    </span>
                </div>
                <div className="vsd-tech-row">
                    <span>Замедление</span>
                    <span className={`vsd-badge ${t.db_is_slow ? 'warn' : 'good'}`}>
                        {t.db_is_slow ? 'Есть' : 'Нет'}
                    </span>
                </div>
                {t.db_last_error && <div className="error-text">{t.db_last_error}</div>}
            </div>

            <div className="vsd-tech-card">
                <h3>Диски и Архив</h3>
                <div className="vsd-tech-row">
                    <span>Ошибки</span>
                    <strong className={t.disks_error_count > 0 ? 'text-danger' : ''}>{t.disks_error_count}</strong>
                </div>
                <div className="vsd-tech-row">
                    <span>Основной архив</span>
                    <strong>{t.disks_stat_main_days.toFixed(1)} дн.</strong>
                </div>
                <div className="vsd-tech-row">
                    <span>Резервный архив</span>
                    <strong>{t.disks_stat_subs_days.toFixed(1)} дн.</strong>
                </div>
                {t.disks_last_error && <div className="error-text">{t.disks_last_error}</div>}
            </div>

            <div className="vsd-tech-card">
                <h3>Службы и Сеть</h3>
                <div className="vsd-tech-row">
                    <span>Скрипты</span>
                    <strong className={t.scripts_ok < t.scripts_total ? 'text-warn' : ''}>
                        {t.scripts_ok} / {t.scripts_total}
                    </strong>
                </div>
                <div className="vsd-tech-row">
                    <span>Соединение</span>
                    <span className={`vsd-badge ${t.network_really_connected ? 'good' : 'bad'}`}>
                        {t.network_really_connected ? 'Есть' : 'Нет'}
                    </span>
                </div>
                {t.network_last_error && <div className="error-text">{t.network_last_error}</div>}
            </div>
        </div>
    );
}

type Tab = 'tech' | 'cameras' | 'channels' | 'events';

// --- Главный компонент ---
export function VideoServerDetailsPage() {
    const { serverId = '' } = useParams();
    const location = useLocation();
    const navigation = location.state as { displayName?: string; serverData?: any; registry?: unknown } | null;
    const serverName = navigation?.displayName || 'Видеосервер';

    const description = navigation?.serverData?.description || 'Описание отсутствует';

    const [activeTab, setActiveTab] = useState<Tab>('tech');
    const [cameraFilter, setCameraFilter] = useState<string | undefined>(undefined);
    const [infoCollapsed, setInfoCollapsed] = useState(false);

    useEffect(() => {
        setActiveTab('tech');
        setCameraFilter(undefined);
        setInfoCollapsed(false);
    }, [serverId]);

    const { user } = useAuthContext();

    const camerasQuery = useQuery({
        queryKey: ['vms-cams-count', serverId],
        queryFn: ({ signal }) => listVideoCameras({ videoServerId: serverId, page: 0, size: 1, sort: 'id' }, signal),
        enabled: !!user && !!serverId
    });
    const channelsQuery = useQuery({
        queryKey: ['vms-chans-count', serverId],
        queryFn: ({ signal }) => listVideoChannels({ videoServerId: serverId, page: 0, size: 1, sort: 'id' }, signal),
        enabled: !!user && !!serverId
    });
    const eventsQuery = useQuery({
        queryKey: ['vms-events-count', serverId],
        queryFn: ({ signal }) => listVideoEvents({ videoServerId: serverId, page: 0, size: 1, sort: 'id' }, signal),
        enabled: !!user && !!serverId
    });

    const t = mockTelemetry;

    return (
        <><Header />
            <div className="app-body vsd-app">
                <Sidebar />
                <main className="workspace vsd-workspace">

                    {/* --- БЛОК СВОДКИ И ТЕЛЕМЕТРИИ --- */}
                    <section className={`vsd-info-card ${infoCollapsed ? 'is-collapsed' : ''}`}>
                        <div className="vsd-info-header">
                            <div
                                className="vsd-title-block clickable"
                                onClick={() => setInfoCollapsed(!infoCollapsed)}
                                title={infoCollapsed ? "Развернуть" : "Свернуть"}
                            >
                                <h2 className="vsd-title">
                                    {serverName} <span className="vsd-title-id">[{serverId}]</span>: <span className="vsd-desc-text">{description}</span>
                                    <svg className={`vsd-title-toggle ${infoCollapsed ? 'collapsed' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m18 15-6-6-6 6"/>
                                    </svg>
                                </h2>
                            </div>
                            <div className="vsd-header-actions">
                            <span className={`vsd-badge ${t.server_ok ? 'good' : 'bad'}`}>
                                {t.server_ok ? 'Сервер работает' : 'Ошибка сервера'}
                            </span>
                                <Link className="btn btn-outline-secondary" to="/video-servers" state={{ registry: navigation?.registry }}>← К реестру</Link>
                            </div>
                        </div>

                        {!infoCollapsed && (
                            <div className="vsd-info-body">
                                <div className="vsd-telemetry-grid">
                                    <button type="button" className="vsd-telemetry-box" onClick={() => setActiveTab('tech')}>
                                        <span className="label">Uptime (нажмите для деталей)</span>
                                        <strong className="value">{formatUptime(t.startup_ts)}</strong>
                                    </button>

                                    <button type="button" className="vsd-telemetry-box" onClick={() => setActiveTab('cameras')}>
                                        <span className="label">Камеры</span>
                                        <strong className={`value ${t.ip_devices_connected < t.ip_devices_total ? 'text-warn' : ''}`}>
                                            {t.ip_devices_connected} <small>/ {t.ip_devices_total}</small>
                                        </strong>
                                    </button>

                                    <button type="button" className="vsd-telemetry-box" onClick={() => setActiveTab('channels')}>
                                        <span className="label">Каналы</span>
                                        <strong className="value">
                                            {t.channels_network_online} <small>/ {t.channels_network_total}</small>
                                        </strong>
                                    </button>
                                </div>

                                <HealthChart />
                            </div>
                        )}
                    </section>

                    {/* --- ВКЛАДКИ С ДАННЫМИ --- */}
                    <div className="vsd-main-panel">
                        <div className="vsd-tabs">
                            <button className={activeTab === 'tech' ? 'active' : ''} onClick={() => setActiveTab('tech')}>
                                Детали
                            </button>
                            <button className={activeTab === 'cameras' ? 'active' : ''} onClick={() => setActiveTab('cameras')}>
                                Камеры <span className="badge-count">{camerasQuery.data?.totalElements ?? '…'}</span>
                            </button>
                            <button className={activeTab === 'channels' ? 'active' : ''} onClick={() => setActiveTab('channels')}>
                                Каналы <span className="badge-count">{channelsQuery.data?.totalElements ?? '…'}</span>
                            </button>
                            <button className={activeTab === 'events' ? 'active' : ''} onClick={() => setActiveTab('events')}>
                                События <span className="badge-count">{eventsQuery.data?.totalElements ?? '…'}</span>
                            </button>
                        </div>

                        <div className="vsd-tab-content">
                            {activeTab === 'tech' && <TechDetailsTab t={t} />}
                            {activeTab === 'cameras' && <CamerasTab serverId={serverId} onShowEvents={(camId) => { setCameraFilter(camId); setActiveTab('events'); }} />}
                            {activeTab === 'channels' && <ChannelsTab serverId={serverId} />}
                            {activeTab === 'events' && <EventsTab serverId={serverId} cameraId={cameraFilter} onClearCamera={() => setCameraFilter(undefined)} />}
                        </div>
                    </div>

                </main>
            </div></>
    );
}

// --- ВКЛАДКА: КАМЕРЫ ---
function CamerasTab({ serverId, onShowEvents }: { serverId: string; onShowEvents: (id: string) => void }) {
    const { user } = useAuthContext();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [params, setParams] = useState<VideoCameraParams>({ videoServerId: serverId, page: 0, size: 15, sort: 'name,ASC' });

    useEffect(() => { setParams(p => ({ ...p, page: 0, q: debouncedSearch || undefined })); }, [debouncedSearch]);

    const query = useQuery({
        queryKey: ['video-server-cameras', user?.id, params],
        queryFn: ({ signal }) => listVideoCameras(params, signal),
        enabled: !!user && !!serverId, retry: false,
    });
    const data = query.isError ? undefined : query.data;

    return (
        <div className="vsd-panel">
            <div className="vsd-toolbar">
                <input type="search" className="form-control vsd-search-input" placeholder="Поиск по названию, коду или ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <button type="button" className="vsd-link" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
            </div>
            {query.isError && <div className="vms-error" role="alert">{videoError(query.error)}</div>}

            <div className="table-responsive">
                <table className="vms-table">
                    <thead><tr>
                        <th>Название / Код</th>
                        <th>Состояние</th>
                        <th>Внешний ID</th>
                        <th style={{ width: 100 }}></th>
                    </tr></thead>
                    <tbody>
                    {!data && !query.isError && <tr><td colSpan={4} className="text-center">Загрузка…</td></tr>}
                    {data && !data.content.length && <tr><td colSpan={4} className="text-center">Камеры не найдены.</td></tr>}
                    {data?.content.map((c) => (
                        <tr key={c.id}>
                            <td>
                                <strong>{c.name ?? 'Без названия'}</strong>
                                <small className="text-muted d-block">{c.code ?? c.id}</small>
                            </td>
                            <td>
                                    <span className={`vsd-badge ${c.status === 'ONLINE' ? 'good' : c.status === 'OFFLINE' ? 'bad' : 'warn'}`}>
                                        {c.status === 'ONLINE' ? 'В сети' : c.status === 'OFFLINE' ? 'Не в сети' : 'Неизвестно'}
                                    </span>
                            </td>
                            <td><span className="vsd-external-id">{c.externalId ?? '—'}</span></td>
                            <td style={{ textAlign: 'right' }}>
                                <button type="button" className="vsd-link" onClick={() => onShowEvents(c.id)}>
                                    События →
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <VideoPager data={data} size={params.size} fetching={query.isFetching} onPage={(page) => setParams(p => ({ ...p, page }))} onSize={(size) => setParams(p => ({ ...p, page: 0, size }))} />
        </div>
    );
}

// --- ВКЛАДКА: КАНАЛЫ ---
function ChannelsTab({ serverId }: { serverId: string }) {
    const { user } = useAuthContext();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [params, setParams] = useState<VideoChannelParams>({ videoServerId: serverId, page: 0, size: 15, sort: 'name,ASC' });

    useEffect(() => { setParams(p => ({ ...p, page: 0, q: debouncedSearch || undefined })); }, [debouncedSearch]);

    const query = useQuery({
        queryKey: ['video-server-channels', user?.id, params],
        queryFn: ({ signal }) => listVideoChannels(params, signal),
        enabled: !!user && !!serverId, retry: false,
    });
    const data = query.isError ? undefined : query.data;

    return (
        <div className="vsd-panel">
            <div className="vsd-toolbar">
                <input type="search" className="form-control vsd-search-input" placeholder="Поиск по названию или ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <button type="button" className="vsd-link" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
            </div>
            {query.isError && <div className="vms-error" role="alert">{videoError(query.error)}</div>}

            <div className="table-responsive">
                <table className="vms-table">
                    <thead><tr>
                        <th>Название</th>
                        <th>Состояние</th>
                        <th>Внешний ID</th>
                        <th>ID Камеры</th>
                    </tr></thead>
                    <tbody>
                    {!data && !query.isError && <tr><td colSpan={4} className="text-center">Загрузка…</td></tr>}
                    {data && !data.content.length && <tr><td colSpan={4} className="text-center">Каналы не найдены.</td></tr>}
                    {data?.content.map((c) => (
                        <tr key={c.id}>
                            <td>
                                <strong>{c.name ?? 'Без названия'}</strong>
                                <small className="text-muted d-block">{c.id}</small>
                            </td>
                            <td>
                                    <span className={`vsd-badge ${c.status === 'ONLINE' ? 'good' : c.status === 'OFFLINE' ? 'bad' : 'warn'}`}>
                                        {c.status === 'ONLINE' ? 'Активен' : c.status === 'OFFLINE' ? 'Отключён' : 'Неизвестно'}
                                    </span>
                            </td>
                            <td><span className="vsd-external-id">{c.externalId ?? '—'}</span></td>
                            <td><span className="vsd-external-id">{c.cameraId ?? '—'}</span></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <VideoPager data={data} size={params.size} fetching={query.isFetching} onPage={(page) => setParams(p => ({ ...p, page }))} onSize={(size) => setParams(p => ({ ...p, page: 0, size }))} />
        </div>
    );
}

// --- ВКЛАДКА: СОБЫТИЯ ---
function EventsTab({ serverId, cameraId, onClearCamera }: { serverId: string; cameraId?: string; onClearCamera: () => void }) {
    const { user } = useAuthContext();
    const [params, setParams] = useState<VideoEventParams>({ videoServerId: serverId, page: 0, size: 15, sort: 'occurredAt,desc' });

    useEffect(() => { setParams(p => ({ ...p, page: 0, cameraId })); }, [cameraId]);

    const query = useQuery({
        queryKey: ['video-server-events', user?.id, params],
        queryFn: ({ signal }) => listVideoEvents(params, signal),
        enabled: !!user && !!serverId, retry: false,
    });
    const data = query.isError ? undefined : query.data;

    return (
        <div className="vsd-panel">
            <div className="vsd-toolbar">
                {cameraId ? (
                    <div className="vsd-active-filter">
                        <span>Фильтр по камере: <strong>{cameraId}</strong></span>
                        <button type="button" className="vsd-link" onClick={onClearCamera}>Сбросить</button>
                    </div>
                ) : <div />}
                <button type="button" className="vsd-link" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
            </div>
            {query.isError && <div className="vms-error" role="alert">{videoError(query.error)}</div>}

            <div className="table-responsive">
                <table className="vms-table">
                    <thead><tr>
                        <th>Время (МСК)</th>
                        <th>Событие</th>
                        <th>Критичность</th>
                        <th>Камера</th>
                        <th>Источник</th>
                    </tr></thead>
                    <tbody>
                    {!data && !query.isError && <tr><td colSpan={5} className="text-center">Загрузка…</td></tr>}
                    {data && !data.content.length && <tr><td colSpan={5} className="text-center">События не найдены.</td></tr>}
                    {data?.content.map((e) => (
                        <tr key={e.eventId}>
                            <td><time dateTime={e.occurredAt}>{videoTime(e.occurredAt)}</time></td>
                            <td>
                                <strong>{e.eventType ?? 'Неизвестно'}</strong>
                                <small className="text-muted d-block">{e.eventId}</small>
                            </td>
                            <td>
                                    <span className={`vsd-badge ${e.severity === 'CRITICAL' ? 'bad' : e.severity === 'WARNING' ? 'warn' : 'good'}`}>
                                        {e.severity ?? '—'}
                                    </span>
                            </td>
                            <td><span className="vsd-external-id">{e.cameraId ?? '—'}</span></td>
                            <td>{e.source ?? '—'}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <VideoPager data={data} size={params.size} fetching={query.isFetching} onPage={(page) => setParams(p => ({ ...p, page }))} onSize={(size) => setParams(p => ({ ...p, page: 0, size }))} />
        </div>
    );
}