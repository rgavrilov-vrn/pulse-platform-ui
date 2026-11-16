import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { useAuthContext } from '../auth/AuthContext';
import {
    listVideoServers,
    getServerHealth,
    type VideoServerParams
} from '../api/videoServers';
import { listFacilities } from '../api/refs';
import { VideoServerCreateDialog } from '../components/VideoServerCreateDialog';
import { VideoPager, videoError } from '../components/VideoServerWidgets';
import { useDebounce } from '../hooks/useDebounce';
import './VideoServersPage.css';
import './VideoServerDetailsPage.css';

// Компонент для точечной загрузки количества камер
function ServerCameraCount({ serverId }: { serverId: string }) {
    const { user } = useAuthContext();
    const query = useQuery({
        queryKey: ['vms-health', serverId],
        queryFn: ({ signal }) => getServerHealth(serverId, signal),
        enabled: !!user && !!serverId,
        retry: false,
        staleTime: 60 * 1000,
    });

    if (query.isPending) return <span className="text-muted">…</span>;
    if (query.isError || !query.data) return <span className="text-muted">—</span>;

    const { ipDevicesConnected, ipDevicesTotal } = query.data;
    const isWarning = ipDevicesConnected < ipDevicesTotal;

    return (
        <Link
            to={`/video-servers/${encodeURIComponent(serverId)}`}
            state={{ defaultTab: 'cameras', defaultCameraStatus: 'OFFLINE' }}
            className="vms-text-link"
            title="Показать камеры не в сети"
        >
            <span className={isWarning ? 'text-warn' : ''} style={{ fontSize: '11px', fontWeight: 600 }}>
                {ipDevicesConnected}
            </span>
            <span className="text-muted" style={{ fontSize: '11px', margin: '0 4px' }}>/</span>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
                {ipDevicesTotal}
            </span>
        </Link>
    );
}

export function VideoServersPage() {
    const { user } = useAuthContext();
    const location = useLocation();
    const restored = location.state as { registry?: { draft: any; params: VideoServerParams } } | null;

    // Фильтры (живые)
    const [search, setSearch] = useState(restored?.registry?.draft?.search ?? '');
    const debouncedSearch = useDebounce(search, 300);

    const [source, setSource] = useState(restored?.registry?.draft?.source ?? '');
    const debouncedSource = useDebounce(source, 300);

    const [status, setStatus] = useState(restored?.registry?.draft?.status ?? '');
    const [active, setActive] = useState(restored?.registry?.draft?.active ?? '');

    const [creating, setCreating] = useState(false);

    // Параметры пагинации и запроса
    const [params, setParams] = useState<VideoServerParams>(() => restored?.registry?.params ?? { page: 0, size: 25, sort: 'name,asc' });

    // Сброс страницы при смене фильтров
    useEffect(() => {
        setParams(p => ({
            ...p,
            page: 0,
            search: debouncedSearch || undefined,
            source: debouncedSource || undefined,
            status: status || undefined,
            isActive: active === '' ? undefined : active === 'true'
        }));
    }, [debouncedSearch, debouncedSource, status, active]);

    // Запрос видеосерверов
    const query = useQuery({
        queryKey: ['video-servers', user?.id, params],
        queryFn: ({ signal }) => listVideoServers(params, signal),
        enabled: !!user,
        retry: false
    });
    const data = query.isError ? undefined : query.data;

    // Запрос объектов для маппинга ID -> Название
    const facilitiesQuery = useQuery({
        queryKey: ['facilities-ref'],
        queryFn: ({ signal }) => listFacilities(signal),
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    });

    // Словарь для быстрого поиска
    const facilitiesMap = new Map(facilitiesQuery.data?.content.map(f => [f.id, f.name]) ?? []);

    return (
        <><Header />
            <div className="app-body vsd-app">
                <Sidebar />
                <main className="workspace vsd-workspace">
                    <div className="page-heading">
                        <div>
                            <div className="breadcrumb-line">Ситуационный центр <span>/</span> Видеосерверы</div>
                            <h1>Видеосерверы</h1>
                        </div>
                        <div className="vms-heading-actions">
                            <button className="btn btn-primary" type="button" onClick={() => setCreating(true)}>+ Новый видеосервер</button>
                        </div>
                    </div>

                    <div className="vsd-main-panel" style={{ flex: 1, minHeight: 0 }}>
                        <div className="vsd-tab-content">
                            <div className="vsd-panel">
                                <div className="vsd-toolbar">
                                    <div className="vsd-toolbar-filters">
                                        <input
                                            type="search"
                                            className="form-control vsd-search-input"
                                            placeholder="Поиск по названию..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                        <input
                                            type="search"
                                            className="form-control vsd-search-input"
                                            placeholder="Источник (код)..."
                                            value={source}
                                            onChange={e => setSource(e.target.value)}
                                        />
                                        <select className="form-control" style={{ width: 160 }} value={status} onChange={e => setStatus(e.target.value)}>
                                            <option value="">Все статусы</option>
                                            <option value="ONLINE">В сети</option>
                                            <option value="OFFLINE">Не в сети</option>
                                            <option value="UNKNOWN">Неизвестно</option>
                                        </select>
                                        <select className="form-control" style={{ width: 160 }} value={active} onChange={e => setActive(e.target.value)}>
                                            <option value="">Все активности</option>
                                            <option value="true">Активные</option>
                                            <option value="false">Неактивные</option>
                                        </select>
                                    </div>
                                </div>

                                {query.isError && <div className="vms-error" role="alert">{videoError(query.error)}</div>}

                                <div className="table-responsive">
                                    <table className="vms-table">
                                        <thead><tr>
                                            <th>Название</th>
                                            <th>Объект</th>
                                            <th>Статус</th>
                                            <th>Камеры</th>
                                            <th>Адрес</th>
                                            <th>Описание</th>
                                        </tr></thead>
                                        <tbody>
                                        {!data && !query.isError && <tr><td colSpan={6} className="text-center">Загрузка…</td></tr>}
                                        {data && !data.content.length && <tr><td colSpan={6} className="text-center">Видеосерверы не найдены.</td></tr>}
                                        {data?.content.map((server) => (
                                            <tr key={server.id}>
                                                <td>
                                                    <Link
                                                        to={`/video-servers/${encodeURIComponent(server.id)}`}
                                                        state={{ registry: { params }, displayName: server.name }}
                                                        className="vms-text-link"
                                                        style={{ fontWeight: 600, color: 'var(--text)' }}
                                                    >
                                                        <span className={`vsd-status-dot ${server.isActive ? 'is-active' : 'is-inactive'}`} title={server.isActive ? 'Активен' : 'Неактивен'} />
                                                        {server.name ?? 'Без названия'}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <small className="text-muted d-block">
                                                        {server.objectId ? (facilitiesMap.get(server.objectId) || server.objectId) : '—'}
                                                    </small>
                                                </td>
                                                <td>
                                                    <span className={`vsd-badge ${server.status === 'ONLINE' ? 'good' : server.status === 'OFFLINE' ? 'bad' : 'warn'}`}>
                                                        {server.status === 'ONLINE' ? 'В сети' : server.status === 'OFFLINE' ? 'Не в сети' : 'Неизвестно'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <ServerCameraCount serverId={server.id} />
                                                </td>
                                                <td>
                                                    <span className="vsd-external-id">{server.host ?? '—'}</span>
                                                </td>
                                                <td>{server.description ?? '—'}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>

                                <VideoPager
                                    data={data}
                                    size={params.size}
                                    fetching={query.isFetching}
                                    onPage={(page) => setParams(p => ({ ...p, page }))}
                                    onSize={(size) => setParams(p => ({ ...p, page: 0, size }))}
                                />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            {creating && <VideoServerCreateDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void query.refetch(); }} />}
        </>
    );
}