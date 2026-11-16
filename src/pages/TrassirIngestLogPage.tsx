import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { DataPagination } from '../components/DataPagination';
import { useAuthContext } from '../auth/AuthContext';
import { listTrassirIngestLogs } from '../api/trassir';
import { useDebounce } from '../hooks/useDebounce';
import './VideoServerDetailsPage.css';

function getEventTime(e: { receivedAt?: string | null }) {
    return e.receivedAt ? new Date(e.receivedAt).toLocaleString('ru-RU') : '—';
}

export function TrassirIngestLogPage() {
    const { user } = useAuthContext();

    // Фильтры
    const [serverId, setServerId] = useState('');
    const debouncedServerId = useDebounce(serverId, 300);

    const [httpStatus, setHttpStatus] = useState('');

    const [responseCode, setResponseCode] = useState('');
    const debouncedResponseCode = useDebounce(responseCode, 300);

    // Пагинация
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(25);

    // Сброс страницы
    useEffect(() => {
        setPage(0);
    }, [debouncedServerId, httpStatus, debouncedResponseCode]);

    const query = useQuery({
        queryKey: ['trassir-ingest-log-global', user?.id, debouncedServerId, httpStatus, debouncedResponseCode, page, size],
        queryFn: ({ signal }) => listTrassirIngestLogs({
            serverId: debouncedServerId.trim() || undefined,
            httpStatus: httpStatus ? Number(httpStatus) : undefined,
            responseCode: debouncedResponseCode.trim() || undefined,
            page,
            size
        }, signal),
        enabled: !!user,
        retry: false,
    });

    const data = query.isError ? undefined : query.data;

    return (
        <><Header />
            <div className="app-body vsd-app">
                <Sidebar />
                <main className="workspace vsd-workspace">
                    <div className="page-heading">
                        <div>
                            <div className="breadcrumb-line">Ситуационный центр <span>/</span> TRASSIR</div>
                            <h1>Журнал запросов (Ingest)</h1>
                        </div>
                        <button type="button" className="btn btn-outline-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
                    </div>

                    <div className="vsd-main-panel" style={{ flex: 1, minHeight: 0 }}>
                        <div className="vsd-tab-content">
                            <div className="vsd-panel">
                                <div className="vsd-toolbar">
                                    <div className="vsd-toolbar-filters">
                                        <input className="form-control vsd-search-input" placeholder="ID Сервера (UUID)..." value={serverId} onChange={e => setServerId(e.target.value)} />
                                        <select className="form-control" style={{ width: 180 }} value={httpStatus} onChange={e => setHttpStatus(e.target.value)}>
                                            <option value="">Все HTTP статусы</option>
                                            <option value="200">200 OK</option>
                                            <option value="400">400 Bad Request</option>
                                            <option value="401">401 Unauthorized</option>
                                            <option value="403">403 Forbidden</option>
                                            <option value="404">404 Not Found</option>
                                            <option value="500">500 Internal Server Error</option>
                                        </select>
                                        <input className="form-control vsd-search-input" placeholder="Код ответа..." value={responseCode} onChange={e => setResponseCode(e.target.value)} />
                                    </div>
                                    <button type="button" className="vsd-link" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
                                </div>

                                {query.isError && <div className="vms-error" role="alert">Ошибка загрузки журнала Ingest.</div>}

                                <div className="table-responsive">
                                    <table className="vms-table">
                                        <thead><tr>
                                            <th>Время получения</th>
                                            <th>ID Сервера</th>
                                            <th>HTTP</th>
                                            <th>Код ответа</th>
                                            <th>Длительность</th>
                                            <th>Детали</th>
                                        </tr></thead>
                                        <tbody>
                                        {!data && !query.isError && <tr><td colSpan={6} className="text-center">Загрузка…</td></tr>}
                                        {data && !data.content.length && <tr><td colSpan={6} className="text-center">Записей не найдено.</td></tr>}
                                        {data?.content.map(log => (
                                            <tr key={log.id}>
                                                <td>
                                                    <time dateTime={log.receivedAt || ''}>{getEventTime(log)}</time>
                                                    {log.batchId && <small className="text-muted d-block">Batch: {log.batchId.split('-')[0]}...</small>}
                                                </td>
                                                <td><span className="vsd-external-id">{log.serverId || '—'}</span></td>
                                                <td>
                                                    <span className={`vsd-badge ${log.httpStatus && log.httpStatus >= 200 && log.httpStatus < 300 ? 'good' : log.httpStatus && log.httpStatus >= 500 ? 'bad' : 'warn'}`}>
                                                        {log.httpStatus || '—'}
                                                    </span>
                                                </td>
                                                <td><code>{log.responseCode || '—'}</code></td>
                                                <td><span className="text-muted">{log.durationMs !== null ? `${log.durationMs} мс` : '—'}</span></td>
                                                <td>
                                                    <details>
                                                        <summary className="vsd-link">Открыть</summary>
                                                        <div style={{ marginTop: 8, fontSize: 11 }}>
                                                            {log.requestUri && <div><strong>URI:</strong> {log.requestUri}</div>}
                                                            {log.errorMessage && <div className="text-danger" style={{ marginTop: 4 }}>{log.errorMessage}</div>}
                                                            {log.requestBody && (
                                                                <div style={{ marginTop: 8 }}>
                                                                    <strong>Тело запроса:</strong>
                                                                    <pre style={{ maxHeight: 100, overflowY: 'auto', padding: 4, background: 'var(--surface-soft)' }}>{log.requestBody}</pre>
                                                                </div>
                                                            )}
                                                            {log.responseBody && (
                                                                <div style={{ marginTop: 8 }}>
                                                                    <strong>Ответ:</strong>
                                                                    <pre style={{ maxHeight: 100, overflowY: 'auto', padding: 4, background: 'var(--surface-soft)' }}>{log.responseBody}</pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </details>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>

                                <DataPagination
                                    page={data?.page ?? page} size={data?.size ?? size}
                                    totalElements={data?.totalElements} totalPages={data?.totalPages}
                                    rowCount={data?.content.length ?? 0} loading={query.isFetching} label="Страницы журнала Ingest"
                                    onPageChange={setPage}
                                    onSizeChange={s => { setSize(s); setPage(0); }}
                                />
                            </div>
                        </div>
                    </div>
                </main>
            </div></>
    );
}