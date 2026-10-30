import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { useAuthContext } from '../auth/AuthContext';
import { listVideoServers, type VideoServerParams, type VideoServer } from '../api/videoServers';
import { VideoServerCreateDialog } from '../components/VideoServerCreateDialog';
import { VideoServerEventsDialog } from '../components/VideoServerEventsDialog';
import { validUuid, VideoPager, videoError, videoTime } from '../components/VideoServerWidgets';
import './VideoServersPage.css';

type Filters = Record<'search' | 'source' | 'objectId' | 'zoneId' | 'status' | 'active' | 'sort', string>;
const blank = (): Filters => ({ search: '', source: '', objectId: '', zoneId: '', status: '', active: '', sort: 'name,asc' });
export function VideoServersPage() {
    const { user } = useAuthContext();
    const [draft, setDraft] = useState<Filters>(blank);
    const [params, setParams] = useState<VideoServerParams>({ page: 0, size: 25, sort: 'name,asc' });
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [eventServer, setEventServer] = useState<VideoServer | null>(null);
    const query = useQuery({
        queryKey: ['video-servers', user?.id, params],
        queryFn: ({ signal }) => listVideoServers(params, signal), enabled: !!user, retry: false,
    });
    const data = query.isError ? undefined : query.data;
    useEffect(() => {
        if (!query.data || query.isFetching || query.isError) return;
        const last = Math.max(0, query.data.totalPages - 1);
        if (params.page > last) setParams((p) => ({ ...p, page: last }));
    }, [query.data, query.isFetching, query.isError, params.page]);
    function apply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        for (const key of ['objectId', 'zoneId'] as const) {
            if (draft[key].trim() && !validUuid(draft[key].trim())) { setError(`${key}: укажите корректный UUID.`); return; }
        }
        setError('');
        setParams({ page: 0, size: params.size, sort: draft.sort,
            search: draft.search.trim() || undefined, source: draft.source.trim() || undefined,
            objectId: draft.objectId.trim() || undefined, zoneId: draft.zoneId.trim() || undefined,
            status: draft.status ? draft.status as VideoServerParams['status'] : undefined,
            isActive: draft.active === '' ? undefined : draft.active === 'true' });
    }
    function reset() {
        setDraft(blank()); setError('');
        setParams((p) => ({ page: 0, size: p.size, sort: 'name,asc' }));
    }
    return <>
        <Header />
        <div className="app-body"><Sidebar /><main className="workspace vms-workspace">
            <div className="page-heading"><div><div className="breadcrumb-line">Ситуационный центр <span>/</span> Видеосерверы</div><h1>Видеосерверы</h1></div>
                <div className="vms-heading-actions"><button className="btn btn-outline-secondary" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
                    <button className="btn btn-primary" type="button" onClick={() => setCreating(true)}>+ Новый видеосервер</button></div>
            </div>
            <section className="panel vms-panel" aria-label="Реестр видеосерверов">
                <form className="vms-filters" onSubmit={apply}>
                    <label>Поиск по названию<input type="search" className="form-control" placeholder="Название видеосервера" value={draft.search} onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))} /></label>
                    <div className="vms-filter-grid">
                        <label>Источник (точный код)<input className="form-control" value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} /></label>
                        <label>Статус<select className="form-control" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                            <option value="">Все</option><option value="ONLINE">В сети (ONLINE)</option><option value="OFFLINE">Не в сети (OFFLINE)</option><option value="UNKNOWN">Неизвестно (UNKNOWN)</option></select></label>
                        <label>Активность<select className="form-control" value={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.value }))}>
                            <option value="">Все</option><option value="true">Активные</option><option value="false">Неактивные</option></select></label>
                        <label>Сортировка<select className="form-control" value={draft.sort} onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}>
                            <option value="name,asc">Название: А–Я</option><option value="name,desc">Название: Я–А</option><option value="createdAt,desc">Сначала новые</option>
                            <option value="createdAt,asc">Сначала старые</option><option value="status,asc">По статусу</option><option value="source,asc">По источнику</option></select></label>
                        <label>ID объекта (UUID)<input className="form-control" value={draft.objectId} onChange={(e) => setDraft((d) => ({ ...d, objectId: e.target.value }))} /></label>
                        <label>ID зоны (UUID)<input className="form-control" value={draft.zoneId} onChange={(e) => setDraft((d) => ({ ...d, zoneId: e.target.value }))} /></label>
                    </div>
                    <div className="vms-actions"><button type="submit" className="btn btn-primary">Применить</button><button type="button" className="btn btn-outline-secondary" onClick={reset}>Сбросить</button>
                        <span>Поиск и фильтры — по всему реестру. Применение кнопкой или Enter.</span></div>
                    {error && <p className="vms-error" role="alert">{error}</p>}
                </form>
                {query.isError && <div className="vms-error vms-message" role="alert">{videoError(query.error)} <button className="btn btn-outline-secondary" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>Повторить</button></div>}
                <div className="vms-scroll" aria-busy={query.isFetching}>
                    <table className="vms-table"><caption>Объекты и зоны указаны по ID из API. Время — МСК.</caption>
                        <thead><tr><th scope="col">Название / источник</th><th scope="col">Адрес</th><th scope="col">Статус / активность</th><th scope="col">Объект / зона</th><th scope="col">Действия / подробности</th></tr></thead>
                        <tbody>
                            {!data && !query.isError && <tr><td colSpan={5}>Загрузка…</td></tr>}
                            {data && !data.content.length && <tr><td colSpan={5}>Видеосерверы по выбранным условиям не найдены.</td></tr>}
                            {data?.content.map((server) => <tr key={server.id}>
                                <td><strong>{server.name ?? 'Без названия'}</strong><span>{server.source ?? '—'}</span><small>Внешний ID: {server.externalId ?? '—'}</small></td>
                                <td><span>{server.host ?? '—'}</span><small>{server.baseUrl ?? '—'}</small></td>
                                <td><span className={`vms-status ${server.status === 'ONLINE' ? 'online' : server.status === 'OFFLINE' ? 'offline' : 'unknown'}`}>
                                    {server.status === 'ONLINE' ? 'В сети' : server.status === 'OFFLINE' ? 'Не в сети' : server.status === 'UNKNOWN' ? 'Неизвестно' : server.status ?? 'Не указан'}</span><small>{server.isActive ? 'Активен' : 'Неактивен'}</small></td>
                                <td><small>Объект</small><code>{server.objectId ?? '—'}</code><small>Зона</small><code>{server.zoneId ?? '—'}</code></td>
                                <td><button type="button" className="btn btn-outline-secondary vms-row-actions" onClick={() => setEventServer(server)} aria-label={`События сервера ${server.name ?? server.id}`}>События</button>
                                    <details><summary>Подробности</summary><dl><dt>ID сервера</dt><dd>{server.id}</dd><dt>Описание</dt><dd>{server.description ?? '—'}</dd>
                                        <dt>Создан (МСК)</dt><dd>{videoTime(server.createdAt)}</dd><dt>Обновлён (МСК)</dt><dd>{videoTime(server.updatedAt)}</dd></dl></details></td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
                <VideoPager data={data} size={params.size} fetching={query.isFetching} onPage={(page) => setParams((p) => ({ ...p, page }))} onSize={(size) => setParams((p) => ({ ...p, page: 0, size }))} />
            </section>
        </main></div>
        {creating && <VideoServerCreateDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reset(); }} />}
        {eventServer && <VideoServerEventsDialog key={eventServer.id} server={eventServer} onClose={() => setEventServer(null)} />}
    </>;
}
