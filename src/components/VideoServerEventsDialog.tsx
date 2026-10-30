import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fromZonedTime } from 'date-fns-tz';
import { useAuthContext } from '../auth/AuthContext';
import { listVideoEvents, type VideoEventParams, type VideoServer } from '../api/videoServers';
import { validUuid, VideoDialog, VideoPager, videoError, videoTime } from './VideoServerWidgets';

export function VideoServerEventsDialog({ server, onClose }: { server: VideoServer; onClose: () => void }) {
    const { user } = useAuthContext();
    const [draft, setDraft] = useState({ cameraId: '', from: '', to: '', sort: 'occurredAt,desc' });
    const [params, setParams] = useState<VideoEventParams>({ videoServerId: server.id, page: 0, size: 25, sort: 'occurredAt,desc' });
    const [error, setError] = useState('');
    const query = useQuery({
        queryKey: ['video-server-events', user?.id, server.id, params],
        queryFn: ({ signal }) => listVideoEvents({ ...params, videoServerId: server.id }, signal),
        enabled: !!user && !!server.id, retry: false,
    });
    const data = query.isError ? undefined : query.data;
    useEffect(() => {
        if (!query.data || query.isFetching || query.isError) return;
        const last = Math.max(0, query.data.totalPages - 1);
        if (params.page > last) setParams((p) => ({ ...p, page: last }));
    }, [query.data, query.isFetching, query.isError, params.page]);
    function apply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (draft.cameraId.trim() && !validUuid(draft.cameraId.trim())) { setError('ID камеры должен быть UUID.'); return; }
        const from = draft.from ? fromZonedTime(draft.from, 'Europe/Moscow') : undefined;
        const to = draft.to ? fromZonedTime(draft.to, 'Europe/Moscow') : undefined;
        if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) { setError('Укажите корректный период.'); return; }
        if (from && to && from > to) { setError('Начало периода позже окончания.'); return; }
        setError('');
        setParams((p) => ({ videoServerId: server.id, page: 0, size: p.size, sort: draft.sort,
            cameraId: draft.cameraId.trim() || undefined, from: from?.toISOString(), to: to?.toISOString() }));
    }
    function reset() {
        setDraft({ cameraId: '', from: '', to: '', sort: 'occurredAt,desc' }); setError('');
        setParams((p) => ({ videoServerId: server.id, page: 0, size: p.size, sort: 'occurredAt,desc' }));
    }
    return <VideoDialog title={`События: ${server.name ?? server.id}`} wide onClose={onClose}>
        <div className="vms-server-id">Видеосервер: {server.id}</div>
        <form className="vms-event-filters" onSubmit={apply}>
            <div className="vms-filter-grid">
                <label>ID камеры (UUID)<input className="form-control" value={draft.cameraId} onChange={(e) => setDraft((d) => ({ ...d, cameraId: e.target.value }))} /></label>
                <label>С (МСК)<input className="form-control" type="datetime-local" step="1" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} /></label>
                <label>По (МСК, включительно)<input className="form-control" type="datetime-local" step="1" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} /></label>
                <label>Сортировка<select className="form-control" value={draft.sort} onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}>
                    <option value="occurredAt,desc">Сначала новые</option><option value="occurredAt,asc">Сначала старые</option>
                </select></label>
            </div>
            <div className="vms-actions"><button className="btn btn-primary" type="submit">Применить</button>
                <button className="btn btn-outline-secondary" type="button" onClick={reset}>Сбросить</button>
                <button className="btn btn-outline-secondary" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button></div>
            {error && <p className="vms-error" role="alert">{error}</p>}
        </form>
        {query.isError && <div className="vms-error" role="alert">{videoError(query.error)} <button type="button" className="btn btn-outline-secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>Повторить</button></div>}
        <div className="vms-scroll" aria-busy={query.isFetching}>
            <table className="vms-table"><caption>Только события выбранного сервера. Время — МСК.</caption>
                <thead><tr><th scope="col">Время (МСК)</th><th scope="col">Тип / критичность</th><th scope="col">Камера / канал</th><th scope="col">Источник / объект</th><th scope="col">Подробности</th></tr></thead>
                <tbody>
                    {!data && !query.isError && <tr><td colSpan={5}>Загрузка…</td></tr>}
                    {data && !data.content.length && <tr><td colSpan={5}>События по выбранным условиям не найдены.</td></tr>}
                    {data?.content.map((item) => <tr key={item.eventId}>
                        <td><time dateTime={item.occurredAt}>{videoTime(item.occurredAt)}</time></td>
                        <td><strong>{item.eventType ?? '—'}</strong><span>{item.severity ?? '—'}</span></td>
                        <td><small>Камера</small><code>{item.cameraId ?? '—'}</code><small>Канал</small><code>{item.channelId ?? '—'}</code></td>
                        <td><span>{item.source ?? '—'}</span><code>{item.objectId ?? '—'}</code></td>
                        <td><details><summary>Открыть</summary><dl><dt>ID события</dt><dd>{item.eventId}</dd><dt>ID исходного события</dt><dd>{item.rawEventId ?? '—'}</dd>
                            <dt>ID сервера</dt><dd>{item.videoServerId}</dd><dt>Версия payload</dt><dd>{item.payloadVersion ?? '—'}</dd></dl></details></td>
                    </tr>)}
                </tbody>
            </table>
        </div>
        <VideoPager data={data} size={params.size} fetching={query.isFetching} onPage={(page) => setParams((p) => ({ ...p, page }))}
            onSize={(size) => setParams((p) => ({ ...p, page: 0, size }))} />
    </VideoDialog>;
}
