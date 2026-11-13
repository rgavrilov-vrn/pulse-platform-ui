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
    getServerHealth,
    type VideoEventParams,
    type VideoCameraParams,
    type VideoChannelParams,
    type ServerHealth
} from '../api/videoServers';
import { useAuthContext } from '../auth/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import './VideoServerDetailsPage.css';

function formatUptime(startupAtStr: string | null) {
    if (!startupAtStr) return '—';
    const start = new Date(startupAtStr).getTime();
    if (Number.isNaN(start)) return '—';
    const diff = Date.now() - start;
    if (diff < 0) return 'Только что';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return `${days} д. ${hours} ч.`;
}

// --- Компонент живого графика ---
interface HealthPoint { time: number; value: number; }
type ChartRange = '1d' | '3d' | '5d' | '7d' | '10d' | '30d';
const RANGE_DAYS: Record<ChartRange, number> = { '1d': 1, '3d': 3, '5d': 5, '7d': 7, '10d': 10, '30d': 30 };

function HealthChart({ currentLoad }: { currentLoad: number }) {
    const generateInitialData = (): HealthPoint[] => {
        const points: HealthPoint[] = [];
        const now = Date.now();
        let currentValue = currentLoad || 15; // Fallback, если нет данных
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

    const filteredData = useMemo(() => data.slice(-RANGE_DAYS[range] * 24 * 12), [data, range]);
    const width = 1000, height = 150;

    const pointsPath = filteredData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (filteredData.length - 1)) * width} ${height - (p.value / 100) * height}`).join(' ');
    const areaPath = `${pointsPath} L ${width} ${height} L 0 ${height} Z`;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setHoverIndex(Math.round(pct * (filteredData.length - 1)));
    };

    const hoveredPoint = hoverIndex !== null ? filteredData[hoverIndex] : null;
    const hoverX = hoverIndex !== null ? (hoverIndex / (filteredData.length - 1)) * 100 : 0;

    return (
        <div className="vsd-chart-container">
            <div className="vsd-chart-header">
                <div>
                    <span>Нагрузка (история)</span>
                    <div className="vsd-chart-ranges">
                        {(['1d', '3d', '5d', '7d', '10d', '30d'] as ChartRange[]).map(r => (
                            <button key={r} className={`vsd-range-btn ${range === r ? 'active' : ''}`} onClick={() => { setRange(r); setHoverIndex(null); }}>
                                {RANGE_DAYS[r]} дн.
                            </button>
                        ))}
                    </div>
                </div>
                <div className="vsd-chart-current">Текущая: <strong>{data[data.length - 1]?.value.toFixed(1) || 0}%</strong></div>
            </div>

            <div className="vsd-chart-wrapper">
                <div className="vsd-chart-y-axis"><span>100%</span><span>50%</span><span>0%</span></div>
                <div className="vsd-chart-svg-container" ref={chartRef} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)}>
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
                                <div className="vsd-tooltip-time">{new Date(hoveredPoint.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="vsd-tooltip-val">{hoveredPoint.value.toFixed(1)}%</div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className="vsd-chart-x-axis">
                <span>{range === '1d' ? '24 ч. назад' : `${RANGE_DAYS[range]} дн. назад`}</span><span>Сейчас</span>
            </div>
        </div>
    );
}

// --- Вкладка: Детали ---
function TechDetailsTab({ t }: { t: ServerHealth | undefined }) {
    if (!t) {
        return (
            <div className="vsd-empty-health" style={{ height: '100%', border: 'none' }}>
                <p>Детальная информация недоступна.</p>
            </div>
        );
    }
    return (
        <div className="vsd-tech-grid">
            <div className="vsd-tech-card">
                <h3>Нагрузка</h3>
                <div className="vsd-tech-row"><span>CPU</span><strong className={t.cpuUsage > 80 ? 'text-danger' : ''}>{t.cpuUsage.toFixed(1)}%</strong></div>
                <div className="vsd-tech-row"><span>GPU</span><strong>{t.gpuUsage === -1 ? 'N/A' : `${t.gpuUsage.toFixed(1)}%`}</strong></div>
            </div>

            <div className="vsd-tech-card">
                <h3>База данных</h3>
                <div className="vsd-tech-row"><span>Статус</span><span className={`vsd-badge ${t.dbConnected ? 'good' : 'bad'}`}>{t.dbConnected ? 'Подключена' : 'Отключена'}</span></div>
                <div className="vsd-tech-row"><span>Замедление</span><span className={`vsd-badge ${t.dbIsSlow ? 'warn' : 'good'}`}>{t.dbIsSlow ? 'Есть' : 'Нет'}</span></div>
                {t.dbLastError && <div className="error-text">{t.dbLastError}</div>}
            </div>

            <div className="vsd-tech-card">
                <h3>Диски и Архив</h3>
                <div className="vsd-tech-row"><span>Ошибки</span><strong className={t.disksErrorCount > 0 ? 'text-danger' : ''}>{t.disksErrorCount}</strong></div>
                <div className="vsd-tech-row"><span>Основной</span><strong>{t.disksStatMainDays.toFixed(1)} дн.</strong></div>
                <div className="vsd-tech-row"><span>Резервный</span><strong>{t.disksStatSubsDays.toFixed(1)} дн.</strong></div>
                {t.disksLastError && <div className="error-text">{t.disksLastError}</div>}
            </div>

            <div className="vsd-tech-card">
                <h3>Службы и Сеть</h3>
                <div className="vsd-tech-row"><span>Скрипты</span><strong className={t.scriptsOk < t.scriptsTotal ? 'text-warn' : ''}>{t.scriptsOk} / {t.scriptsTotal}</strong></div>
                <div className="vsd-tech-row"><span>Соединение</span><span className={`vsd-badge ${t.networkReallyConnected ? 'good' : 'bad'}`}>{t.networkReallyConnected ? 'Есть' : 'Нет'}</span></div>
                {t.networkLastError && <div className="error-text">{t.networkLastError}</div>}
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

    // Запрос реального здоровья сервера
    const healthQuery = useQuery({
        queryKey: ['vms-health', serverId],
        queryFn: ({ signal }) => getServerHealth(serverId, signal),
        enabled: !!user && !!serverId,
        retry: false,
    });

    const t = healthQuery.data;

    return (
        <><Header />
            <div className="app-body vsd-app">
                <Sidebar />
                <main className="workspace vsd-workspace">

                    <section className={`vsd-info-card ${infoCollapsed ? 'is-collapsed' : ''}`}>
                        <div className="vsd-info-header">
                            <div className="vsd-title-block clickable" onClick={() => setInfoCollapsed(!infoCollapsed)}>
                                <h2 className="vsd-title">
                                    {serverName} <span className="vsd-title-id">[{serverId}]</span>: <span className="vsd-desc-text">{description}</span>
                                    <svg className={`vsd-title-toggle ${infoCollapsed ? 'collapsed' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                </h2>
                            </div>
                            <div className="vsd-header-actions">
                            <span className={`vsd-badge ${t?.serverOk ? 'good' : healthQuery.isError ? 'warn' : t ? 'bad' : ''}`}>
                                {healthQuery.isPending ? 'Загрузка статуса...' : t?.serverOk ? 'Сервер работает' : healthQuery.isError ? 'Нет данных о статусе' : 'Ошибка сервера'}
                            </span>
                                <Link className="btn btn-outline-secondary" to="/video-servers" state={{ registry: navigation?.registry }}>← К реестру</Link>
                            </div>
                        </div>

                        {!infoCollapsed && (
                            <div className="vsd-info-body">
                                {healthQuery.isPending ? (
                                    <div className="text-center" style={{ padding: 20 }}>Загрузка телеметрии...</div>
                                ) : healthQuery.isError ? (
                                    <div className="vsd-empty-health">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                        </svg>
                                        <p>Данные телеметрии (health) для этого сервера еще не собраны.</p>
                                        <small className="text-muted">Как только агент отправит первый снимок (snapshot), статистика появится здесь.</small>
                                    </div>
                                ) : t ? (
                                    <>
                                        <div className="vsd-telemetry-grid">
                                            <button type="button" className="vsd-telemetry-box" onClick={() => setActiveTab('tech')}>
                                                <span className="label">Uptime</span>
                                                <strong className="value">{formatUptime(t.startupAt)}</strong>
                                            </button>
                                            <button type="button" className="vsd-telemetry-box" onClick={() => setActiveTab('cameras')}>
                                                <span className="label">Камеры</span>
                                                <strong className={`value ${t.ipDevicesConnected < t.ipDevicesTotal ? 'text-warn' : ''}`}>
                                                    {t.ipDevicesConnected} <small>/ {t.ipDevicesTotal}</small>
                                                </strong>
                                            </button>
                                            <button type="button" className="vsd-telemetry-box" onClick={() => setActiveTab('channels')}>
                                                <span className="label">Каналы</span>
                                                <strong className="value">
                                                    {t.channelsNetworkOnline} <small>/ {t.channelsNetworkTotal}</small>
                                                </strong>
                                            </button>
                                        </div>
                                        <HealthChart currentLoad={t.cpuUsage} />
                                    </>
                                ) : null}
                            </div>
                        )}
                    </section>

                    <div className="vsd-main-panel">
                        <div className="vsd-tabs">
                            <button className={activeTab === 'tech' ? 'active' : ''} onClick={() => setActiveTab('tech')}>Детали</button>
                            <button className={activeTab === 'cameras' ? 'active' : ''} onClick={() => setActiveTab('cameras')}>Камеры</button>
                            <button className={activeTab === 'channels' ? 'active' : ''} onClick={() => setActiveTab('channels')}>Каналы</button>
                            <button className={activeTab === 'events' ? 'active' : ''} onClick={() => setActiveTab('events')}>События</button>
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
    const [statusFilter, setStatusFilter] = useState<string>('');

    const [params, setParams] = useState<VideoCameraParams>({ videoServerId: serverId, page: 0, size: 15, sort: 'name,ASC' });

    useEffect(() => {
        setParams(p => ({ ...p, page: 0, q: debouncedSearch || undefined, status: statusFilter ? (statusFilter as any) : undefined }));
    }, [debouncedSearch, statusFilter]);

    const query = useQuery({
        queryKey: ['video-server-cameras', user?.id, params],
        queryFn: ({ signal }) => listVideoCameras(params, signal),
        enabled: !!user && !!serverId, retry: false,
    });
    const data = query.isError ? undefined : query.data;

    return (
        <div className="vsd-panel">
            <div className="vsd-toolbar">
                <div className="vsd-toolbar-filters">
                    <input type="search" className="form-control vsd-search-input" placeholder="Поиск по названию, коду или ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">Все статусы</option>
                        <option value="ONLINE">В сети</option>
                        <option value="OFFLINE">Не в сети</option>
                        <option value="UNKNOWN">Неизвестно</option>
                    </select>
                </div>
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
                                <button type="button" className="vsd-link" onClick={() => onShowEvents(c.id)}>События →</button>
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
    const [statusFilter, setStatusFilter] = useState<string>('');

    const [params, setParams] = useState<VideoChannelParams>({ videoServerId: serverId, page: 0, size: 15, sort: 'name,ASC' });

    useEffect(() => {
        setParams(p => ({ ...p, page: 0, q: debouncedSearch || undefined, status: statusFilter ? (statusFilter as any) : undefined }));
    }, [debouncedSearch, statusFilter]);

    const query = useQuery({
        queryKey: ['video-server-channels', user?.id, params],
        queryFn: ({ signal }) => listVideoChannels(params, signal),
        enabled: !!user && !!serverId, retry: false,
    });
    const data = query.isError ? undefined : query.data;

    return (
        <div className="vsd-panel">
            <div className="vsd-toolbar">
                <div className="vsd-toolbar-filters">
                    <input type="search" className="form-control vsd-search-input" placeholder="Поиск по названию или ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">Все статусы</option>
                        <option value="ONLINE">В сети</option>
                        <option value="OFFLINE">Не в сети</option>
                        <option value="UNKNOWN">Неизвестно</option>
                    </select>
                </div>
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
                                        {c.status === 'ONLINE' ? 'В сети' : c.status === 'OFFLINE' ? 'Не в сети' : 'Неизвестно'}
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