import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { DataPagination } from '../components/DataPagination';
import { useAuthContext } from '../auth/AuthContext';
import {
    listTrassirEvents,
    listTrassirSystemEvents,
    retryTrassirEvent,
    type TrassirEventView
} from '../api/trassir';
import { useDebounce } from '../hooks/useDebounce';
import './VideoServerDetailsPage.css';

type Tab = 'system' | 'raw';

function getEventTime(e: { occurredAt?: string | null; observedAt?: string | null; createdAt?: string | null; receivedAt?: string | null }) {
    const timeStr = e.occurredAt || e.observedAt || e.createdAt || e.receivedAt;
    return timeStr ? new Date(timeStr).toLocaleString('ru-RU') : '—';
}

export function TrassirEventsPage() {
    const { user } = useAuthContext();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('system');

    // Фильтры
    const [serverId, setServerId] = useState('');
    const debouncedServerId = useDebounce(serverId, 300);

    const [eventType, setEventType] = useState('');
    const debouncedEventType = useDebounce(eventType, 300);

    const [severity, setSeverity] = useState(''); // для системных
    const [status, setStatus] = useState('');     // для сырых

    // Стейты пагинации
    const [sysPage, setSysPage] = useState(0);
    const [sysSize, setSysSize] = useState(25);
    const [rawPage, setRawPage] = useState(0);
    const [rawSize, setRawSize] = useState(25);

    // Сброс страниц при смене любых фильтров
    useEffect(() => {
        setSysPage(0);
        setRawPage(0);
    }, [debouncedServerId, debouncedEventType, severity, status, activeTab]);

    const sysQuery = useQuery({
        queryKey: ['trassir-system-events', user?.id, debouncedServerId, debouncedEventType, severity, sysPage, sysSize],
        queryFn: ({ signal }) => listTrassirSystemEvents({
            serverId: debouncedServerId || undefined,
            eventType: debouncedEventType || undefined,
            severity: severity || undefined,
            page: sysPage,
            size: sysSize
        }, signal),
        enabled: !!user && activeTab === 'system',
        retry: false,
    });

    const rawQuery = useQuery({
        queryKey: ['trassir-raw-events', user?.id, debouncedServerId, debouncedEventType, status, rawPage, rawSize],
        queryFn: ({ signal }) => listTrassirEvents({
            serverId: debouncedServerId || undefined,
            eventType: debouncedEventType || undefined,
            status: status || undefined,
            page: rawPage,
            size: rawSize
        }, signal),
        enabled: !!user && activeTab === 'raw',
        retry: false,
    });

    const activeQuery = activeTab === 'system' ? sysQuery : rawQuery;
    const data = activeQuery.isError ? undefined : activeQuery.data;

    return (
        <><Header />
            <div className="app-body vsd-app">
                <Sidebar />
                <main className="workspace vsd-workspace">
                    <div className="page-heading">
                        <div>
                            <div className="breadcrumb-line">Ситуационный центр <span>/</span> TRASSIR</div>
                            <h1>События TRASSIR</h1>
                        </div>
                        <button type="button" className="btn btn-outline-secondary" disabled={activeQuery.isFetching} onClick={() => void activeQuery.refetch()}>Обновить</button>
                    </div>

                    <div className="vsd-main-panel" style={{ flex: 1, minHeight: 0 }}>
                        <div className="vsd-tabs">
                            <button className={activeTab === 'system' ? 'active' : ''} onClick={() => setActiveTab('system')}>Системные события</button>
                            <button className={activeTab === 'raw' ? 'active' : ''} onClick={() => setActiveTab('raw')}>Сырые события (Ingest)</button>
                        </div>

                        <div className="vsd-tab-content">
                            <div className="vsd-panel">
                                <div className="vsd-toolbar">
                                    <div className="vsd-toolbar-filters">
                                        <input className="form-control vsd-search-input" placeholder="ID сервера (UUID)..." value={serverId} onChange={e => setServerId(e.target.value)} />
                                        <input type="search" className="form-control vsd-search-input" placeholder="Тип события..." value={eventType} onChange={e => setEventType(e.target.value)} />

                                        {activeTab === 'system' && (
                                            <select className="form-control" style={{ width: 160 }} value={severity} onChange={e => setSeverity(e.target.value)}>
                                                <option value="">Все критичности</option>
                                                <option value="INFO">INFO</option>
                                                <option value="WARNING">WARNING</option>
                                                <option value="CRITICAL">CRITICAL</option>
                                            </select>
                                        )}

                                        {activeTab === 'raw' && (
                                            <select className="form-control" style={{ width: 160 }} value={status} onChange={e => setStatus(e.target.value)}>
                                                <option value="">Все статусы</option>
                                                <option value="PROCESSED">PROCESSED</option>
                                                <option value="FAILED">FAILED</option>
                                                <option value="DEAD_LETTER">DEAD_LETTER</option>
                                                <option value="PENDING">PENDING</option>
                                            </select>
                                        )}
                                    </div>
                                    <button type="button" className="vsd-link" disabled={activeQuery.isFetching} onClick={() => void activeQuery.refetch()}>Обновить</button>
                                </div>

                                {activeQuery.isError && <div className="vms-error" role="alert">Ошибка загрузки данных.</div>}

                                <div className="table-responsive">
                                    {activeTab === 'system' && (
                                        <table className="vms-table">
                                            <thead><tr>
                                                <th>Время</th><th>Тип</th><th>Критичность</th><th>Объект</th><th>Сервер</th>
                                            </tr></thead>
                                            <tbody>
                                            {!sysQuery.data && !sysQuery.isError && <tr><td colSpan={5} className="text-center">Загрузка…</td></tr>}
                                            {sysQuery.data && !sysQuery.data.content.length && <tr><td colSpan={5} className="text-center">События не найдены.</td></tr>}
                                            {sysQuery.data?.content.map(e => {
                                                const objectName = e.objectName || e.objectId;

                                                return (
                                                    <tr key={e.id}>
                                                        <td><time dateTime={e.occurredAt || ''}>{getEventTime(e)}</time></td>
                                                        <td><strong>{e.eventType || '—'}</strong><small className="text-muted d-block">{e.eventVersion}</small></td>
                                                        <td><span className={`vsd-badge ${e.severity === 'CRITICAL' ? 'bad' : e.severity === 'WARNING' ? 'warn' : 'good'}`}>{e.severity || '—'}</span></td>
                                                        <td>
                                                            {e.serverId && objectName ? (
                                                                <button
                                                                    type="button"
                                                                    className="vsd-link"
                                                                    title="Перейти к событиям объекта"
                                                                    onClick={() => navigate(`/video-servers/${e.serverId}`, { state: { defaultTab: 'events', cameraFilter: e.objectId || objectName } })}
                                                                >
                                                                    {objectName}
                                                                </button>
                                                            ) : (
                                                                <span>{objectName || '—'}</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {e.serverId ? (
                                                                <button
                                                                    type="button"
                                                                    className="vsd-link"
                                                                    title="Перейти в карточку сервера"
                                                                    onClick={() => navigate(`/video-servers/${e.serverId}`)}
                                                                >
                                                                    <span className="vsd-external-id">{e.serverId}</span>
                                                                </button>
                                                            ) : '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    )}

                                    {activeTab === 'raw' && (
                                        <RawEventsTable data={rawQuery.data?.content || []} isPending={rawQuery.isPending} />
                                    )}
                                </div>

                                <DataPagination
                                    page={activeTab === 'system' ? (sysQuery.data?.page ?? sysPage) : (rawQuery.data?.page ?? rawPage)}
                                    size={activeTab === 'system' ? sysSize : rawSize}
                                    totalElements={data?.totalElements} totalPages={data?.totalPages}
                                    rowCount={data?.content.length ?? 0} loading={activeQuery.isFetching} label="Страницы событий"
                                    onPageChange={p => activeTab === 'system' ? setSysPage(p) : setRawPage(p)}
                                    onSizeChange={s => { if(activeTab === 'system') { setSysSize(s); setSysPage(0); } else { setRawSize(s); setRawPage(0); } }}
                                />
                            </div>
                        </div>
                    </div>
                </main>
            </div></>
    );
}

function RawEventsTable({ data, isPending }: { data: TrassirEventView[]; isPending: boolean }) {
    const qc = useQueryClient();
    const navigate = useNavigate();

    const retryMutation = useMutation({
        mutationFn: retryTrassirEvent,
        onSuccess: () => {
            toast.success('Событие отправлено на повторную обработку');
            qc.invalidateQueries({ queryKey: ['trassir-raw-events'] });
        },
        onError: (err) => {
            const msg = isAxiosError(err) && err.response?.data?.message ? err.response.data.message : 'Ошибка при попытке повтора';
            toast.error(msg);
        }
    });

    return (
        <table className="vms-table">
            <thead><tr>
                <th>Время</th><th>Тип</th><th>Статус</th><th>Ошибка</th><th>Сервер</th><th></th>
            </tr></thead>
            <tbody>
            {isPending && <tr><td colSpan={6} className="text-center">Загрузка…</td></tr>}
            {!isPending && !data.length && <tr><td colSpan={6} className="text-center">События не найдены.</td></tr>}
            {data.map(e => {
                const canRetry = e.status === 'FAILED' || e.status === 'DEAD_LETTER';
                return (
                    <tr key={e.id}>
                        <td><time dateTime={e.occurredAt || ''}>{getEventTime(e)}</time></td>
                        <td><strong>{e.eventType || '—'}</strong></td>
                        <td>
                                <span className={`vsd-badge ${e.status === 'PROCESSED' ? 'good' : e.status === 'FAILED' ? 'bad' : 'warn'}`}>
                                    {e.status || 'UNKNOWN'}
                                </span>
                            {e.retryCount > 0 && <small className="text-muted d-block" style={{marginTop: 4}}>Retries: {e.retryCount}</small>}
                        </td>
                        <td><span className="text-danger" style={{fontSize: 11, wordBreak: 'break-all'}}>{e.lastError || '—'}</span></td>
                        <td>
                            {e.serverId ? (
                                <button
                                    type="button"
                                    className="vsd-link"
                                    title="Перейти в карточку сервера"
                                    onClick={() => navigate(`/video-servers/${e.serverId}`)}
                                >
                                    <span className="vsd-external-id">{e.serverId}</span>
                                </button>
                            ) : '—'}
                        </td>
                        <td style={{textAlign: 'right'}}>
                            {canRetry && (
                                <button className="vsd-link" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate(e.id)}>
                                    Повторить
                                </button>
                            )}
                        </td>
                    </tr>
                );
            })}
            </tbody>
        </table>
    );
}