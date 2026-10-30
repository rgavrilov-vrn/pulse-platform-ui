import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { fromZonedTime } from 'date-fns-tz';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { useAuthContext } from '../auth/AuthContext';
import { listAudit, type AuditParams } from '../api/audit';
import './AuditPage.css';

const exactFields = [
    ['action', 'Действие (точное значение)'],
    ['entitySchema', 'Схема'],
    ['entityTable', 'Таблица'],
    ['actorId', 'ID пользователя (UUID)'],
    ['entityId', 'ID сущности (UUID)'],
    ['requestId', 'ID запроса'],
] as const;
type Filters = Record<'q' | 'action' | 'entitySchema' | 'entityTable' | 'actorId' | 'entityId' | 'requestId' | 'from' | 'to' | 'sort', string>;
const initialFilters = (): Filters => ({
    q: '', action: '', entitySchema: '', entityTable: '', actorId: '',
    entityId: '', requestId: '', from: '', to: '', sort: 'occurredAt,desc',
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function displayTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}
function errorMessage(error: unknown) {
    if (isAxiosError(error)) {
        if (error.response?.status === 403) return 'Нет права audit:read для просмотра журнала.';
        if (error.response?.status === 404) return 'API /api/v1/audit не найден. Проверьте адрес и версию backend.';
        if (error.response?.status === 400) return 'Сервер отклонил параметры. Проверьте фильтры и период.';
    }
    return 'Не удалось загрузить журнал аудита. Повторите запрос.';
}

export function AuditPage() {
    const { user } = useAuthContext();
    const [draft, setDraft] = useState<Filters>(initialFilters);
    const [params, setParams] = useState<AuditParams>({ page: 0, size: 25, sort: 'occurredAt,desc' });
    const [validation, setValidation] = useState('');
    const query = useQuery({
        queryKey: ['audit', user?.id, params],
        queryFn: ({ signal }) => listAudit(params, signal),
        enabled: !!user,
        retry: (count, error) => !(isAxiosError(error) && [400, 401, 403, 404].includes(error.response?.status ?? 0)) && count < 1,
    });
    const data = query.isError ? undefined : query.data;
    useEffect(() => {
        if (!query.data || query.isFetching || query.isError) return;
        const last = Math.max(0, query.data.totalPages - 1);
        if (params.page > last) setParams((p) => ({ ...p, page: last }));
    }, [query.data, query.isFetching, query.isError, params.page]);

    function apply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        for (const key of ['actorId', 'entityId'] as const) {
            if (draft[key].trim() && !uuid.test(draft[key].trim())) {
                setValidation(`${key}: укажите UUID в формате xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.`);
                return;
            }
        }
        const from = draft.from ? fromZonedTime(draft.from, 'Europe/Moscow') : undefined;
        const to = draft.to ? fromZonedTime(draft.to, 'Europe/Moscow') : undefined;
        if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
            setValidation('Укажите корректные дату и время.'); return;
        }
        if (from && to && from > to) {
            setValidation('Начало периода не может быть позже окончания.'); return;
        }
        const next: AuditParams = { page: 0, size: params.size, sort: draft.sort };
        for (const [key] of exactFields) next[key] = draft[key].trim() || undefined;
        next.q = draft.q.trim() || undefined;
        next.from = from?.toISOString();
        next.to = to?.toISOString();
        setValidation('');
        setParams(next);
    }
    function reset() {
        setDraft(initialFilters());
        setValidation('');
        setParams((p) => ({ page: 0, size: p.size, sort: 'occurredAt,desc' }));
    }
    const total = data?.totalElements ?? 0;
    const count = data?.content.length ?? 0;
    const first = count ? (data?.page ?? 0) * (data?.size ?? params.size) + 1 : 0;
    const last = count ? first + count - 1 : 0;
    const busy = query.isFetching || !data;

    return (
        <>
            <Header />
            <div className="app-body">
                <Sidebar />
                <main className="workspace audit-workspace">
                    <div className="page-heading">
                        <div>
                            <div className="breadcrumb-line">Ситуационный центр <span>/</span> Аудит</div>
                            <h1>Журнал аудита</h1>
                        </div>
                        <button type="button" className="btn btn-outline-secondary" disabled={query.isFetching}
                            onClick={() => void query.refetch()}>Обновить</button>
                    </div>
                    <section className="panel audit-panel" aria-label="Журнал аудита">
                        <form className="audit-filters" onSubmit={apply}>
                            <label className="audit-search">Поиск по всему журналу
                                <input className="form-control" type="search" value={draft.q}
                                    placeholder="Действие, ID запроса, браузер, схема или таблица"
                                    onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} />
                            </label>
                            <details className="audit-filter-details">
                                <summary>Точные фильтры и период</summary>
                                <div className="audit-filter-grid">
                                    {exactFields.map(([key, label]) => (
                                        <label key={key}>{label}<input className="form-control" value={draft[key]}
                                            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} /></label>
                                    ))}
                                    <label>С (МСК)<input className="form-control" type="datetime-local" step="1" value={draft.from}
                                        onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} /></label>
                                    <label>По (МСК, включительно)<input className="form-control" type="datetime-local" step="1" value={draft.to}
                                        onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} /></label>
                                </div>
                            </details>
                            <div className="audit-filter-actions">
                                <label>Сортировка<select className="form-control" value={draft.sort}
                                    onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}>
                                    <option value="occurredAt,desc">Сначала новые</option>
                                    <option value="occurredAt,asc">Сначала старые</option>
                                    <option value="action,asc">Действие: А–Я</option>
                                    <option value="action,desc">Действие: Я–А</option>
                                </select></label>
                                <button className="btn btn-primary" type="submit">Применить</button>
                                <button className="btn btn-outline-secondary" type="button" onClick={reset}>Сбросить</button>
                                <span className="subtle">Поиск и фильтры применяются кнопкой «Применить» или Enter.</span>
                            </div>
                            {validation && <p className="audit-error" role="alert">{validation}</p>}
                        </form>
                        {query.isError && <div className="audit-error audit-message" role="alert">
                            {errorMessage(query.error)} <button type="button" className="btn btn-outline-secondary"
                                onClick={() => void query.refetch()} disabled={query.isFetching}>Повторить</button>
                        </div>}
                        <div className="audit-scroll" aria-busy={query.isFetching}>
                            <table className="audit-table">
                                <caption className="audit-caption">Время — МСК. Пользователи и сущности показаны по ID из API.</caption>
                                <thead><tr><th scope="col">Время (МСК)</th><th scope="col">Действие</th>
                                    <th scope="col">Пользователь</th><th scope="col">Сущность</th>
                                    <th scope="col">IP / запрос</th><th scope="col">Подробности</th></tr></thead>
                                <tbody>
                                    {!data && !query.isError && <tr><td colSpan={6}>Загрузка…</td></tr>}
                                    {data && !count && <tr><td colSpan={6}>По выбранным условиям записей нет.</td></tr>}
                                    {data?.content.map((entry) => (
                                        <tr key={entry.id}>
                                            <td><time dateTime={entry.occurredAt}>{displayTime(entry.occurredAt)}</time></td>
                                            <td><strong>{entry.action}</strong></td>
                                            <td><code>{entry.actorId ?? '—'}</code></td>
                                            <td><span>{entry.entitySchema}.{entry.entityTable}</span><code>{entry.entityId ?? '—'}</code></td>
                                            <td><span>{entry.sourceIp ?? '—'}</span><code>{entry.requestId ?? '—'}</code></td>
                                            <td><details><summary>Открыть</summary><dl>
                                                <dt>ID записи</dt><dd>{entry.id}</dd>
                                                <dt>Время UTC</dt><dd>{entry.occurredAt}</dd>
                                                <dt>User-Agent</dt><dd>{entry.userAgent ?? '—'}</dd>
                                            </dl></details></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <footer className="audit-pagination">
                            <span role="status" aria-live="polite">{query.isFetching ? 'Обновление…' : data ? `Показано ${first}–${last} из ${total}` : 'Данные недоступны'}</span>
                            <label>Строк на странице<select className="form-control" value={params.size} disabled={query.isFetching}
                                onChange={(e) => setParams((p) => ({ ...p, size: Number(e.target.value), page: 0 }))}>
                                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select></label>
                            <nav aria-label="Страницы журнала аудита">
                                <button className="btn btn-outline-secondary" disabled={busy || !data?.hasPrevious}
                                    onClick={() => setParams((p) => ({ ...p, page: 0 }))} aria-label="Первая страница">«</button>
                                <button className="btn btn-outline-secondary" disabled={busy || !data?.hasPrevious}
                                    onClick={() => setParams((p) => ({ ...p, page: Math.max(0, p.page - 1) }))}>Назад</button>
                                <span>{data ? `Страница ${data.totalPages ? data.page + 1 : 0} из ${data.totalPages}` : '—'}</span>
                                <button className="btn btn-outline-secondary" disabled={busy || !data?.hasNext}
                                    onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>Далее</button>
                                <button className="btn btn-outline-secondary" disabled={busy || !data?.hasNext}
                                    onClick={() => setParams((p) => ({ ...p, page: Math.max(0, (data?.totalPages ?? 1) - 1) }))}
                                    aria-label="Последняя страница">»</button>
                            </nav>
                        </footer>
                    </section>
                </main>
            </div>
        </>
    );
}
