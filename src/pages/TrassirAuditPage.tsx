import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { DataPagination } from '../components/DataPagination';
import { useAuthContext } from '../auth/AuthContext';
import { listTrassirAuditLog } from '../api/trassir';
import { useDebounce } from '../hooks/useDebounce';
import './VideoServerDetailsPage.css';

export function TrassirAuditPage() {
    const { user } = useAuthContext();

    // Фильтры
    const [actor, setActor] = useState('');
    const debouncedActor = useDebounce(actor, 300);

    const [action, setAction] = useState('');
    const debouncedAction = useDebounce(action, 300);

    const [status, setStatus] = useState('');

    // Пагинация
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(25);

    // Сброс страницы при смене фильтров
    useEffect(() => {
        setPage(0);
    }, [debouncedActor, debouncedAction, status]);

    const query = useQuery({
        queryKey: ['trassir-audit', user?.id, debouncedActor, debouncedAction, status, page, size],
        queryFn: ({ signal }) => listTrassirAuditLog({
            actor: debouncedActor.trim() || undefined,
            action: debouncedAction.trim() || undefined,
            status: status || undefined,
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
                            <h1>Аудит TRASSIR</h1>
                        </div>
                        <button type="button" className="btn btn-outline-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
                    </div>

                    <div className="vsd-main-panel" style={{ flex: 1, minHeight: 0 }}>
                        <div className="vsd-tab-content">
                            <div className="vsd-panel">
                                <div className="vsd-toolbar">
                                    <div className="vsd-toolbar-filters">
                                        <input className="form-control vsd-search-input" placeholder="Автор (имя или ID)..." value={actor} onChange={e => setActor(e.target.value)} />
                                        <input className="form-control vsd-search-input" placeholder="Действие..." value={action} onChange={e => setAction(e.target.value)} />
                                        <select className="form-control" style={{ width: 160 }} value={status} onChange={e => setStatus(e.target.value)}>
                                            <option value="">Все статусы</option>
                                            <option value="SUCCESS">SUCCESS</option>
                                            <option value="FAILED">FAILED</option>
                                        </select>
                                    </div>
                                    <button type="button" className="vsd-link" disabled={query.isFetching} onClick={() => void query.refetch()}>Обновить</button>
                                </div>

                                {query.isError && <div className="vms-error" role="alert">Ошибка загрузки аудита TRASSIR.</div>}

                                <div className="table-responsive">
                                    <table className="vms-table">
                                        <thead><tr>
                                            <th>Время</th><th>Автор</th><th>Действие</th><th>Объект</th><th>Статус</th><th>Детали</th>
                                        </tr></thead>
                                        <tbody>
                                        {!data && !query.isError && <tr><td colSpan={6} className="text-center">Загрузка…</td></tr>}
                                        {data && !data.content.length && <tr><td colSpan={6} className="text-center">Записей не найдено.</td></tr>}
                                        {data?.content.map(entry => (
                                            <tr key={entry.id}>
                                                <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('ru-RU') : '—'}</td>
                                                <td><span className="vsd-external-id">{entry.actor || '—'}</span></td>
                                                <td><code>{entry.action || '—'}</code></td>
                                                <td><span className="vsd-external-id">{entry.target || '—'}</span></td>
                                                <td>
                                                    <span className={`vsd-badge ${entry.status === 'SUCCESS' ? 'good' : 'bad'}`}>
                                                        {entry.status || '—'}
                                                    </span>
                                                    {entry.affectedCount !== null && <small className="text-muted d-block" style={{marginTop: 4}}>Затронуто: {entry.affectedCount}</small>}
                                                </td>
                                                <td>
                                                    <details>
                                                        <summary className="vsd-link">Открыть</summary>
                                                        <div style={{ marginTop: 8, fontSize: 11 }}>
                                                            {entry.errorMessage && <div className="text-danger" style={{ marginTop: 4 }}>{entry.errorMessage}</div>}
                                                            {entry.details && <pre style={{ maxHeight: 100, overflowY: 'auto', padding: 4, background: 'var(--surface-soft)' }}>{JSON.stringify(entry.details, null, 2)}</pre>}
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
                                    rowCount={data?.content.length ?? 0} loading={query.isFetching} label="Страницы аудита TRASSIR"
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