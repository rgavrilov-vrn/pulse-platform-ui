import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { useAuthContext } from '../auth/AuthContext';
import { objectReportsApi, type ReportEntry, type ReportOption } from '../api/objectReports';
import './ObjectReportsPage.css';

const statuses: Record<string, string> = { DRAFT: 'Черновик', RECORDED: 'Зарегистрировано', NEEDS_REVIEW: 'На рассмотрении', CONFIRMED: 'Подтверждено', REJECTED: 'Отклонено', CLOSED: 'Закрыто', CANCELLED: 'Отменено', ARCHIVED: 'В архиве' };
const time = (value: string | null) => value && !Number.isNaN(new Date(value).getTime()) ? formatInTimeZone(value, 'Europe/Moscow', 'dd.MM.yyyy HH:mm:ss') : '—';
const inputTime = (value: string | null) => value && !Number.isNaN(new Date(value).getTime()) ? formatInTimeZone(value, 'Europe/Moscow', "yyyy-MM-dd'T'HH:mm:ss") : '';
interface Draft { objectId: string; kind: string; categoryIds: string[]; checklistItemIds: string[]; statuses: string[]; createdBy: string; search: string; from: string; to: string; sort: string }
function read(p: URLSearchParams): Draft {
    return { objectId: p.get('unassigned') === 'true' ? 'unassigned' : p.get('objectId') ?? '', kind: p.get('kind') ?? '', categoryIds: p.getAll('categoryIds'), checklistItemIds: p.getAll('checklistItemIds'), statuses: p.getAll('statuses'), createdBy: p.get('createdBy') ?? '', search: p.get('search') ?? '', from: inputTime(p.get('eventFrom')), to: inputTime(p.get('eventTo')), sort: p.get('sort') ?? 'eventTime,desc' };
}
function Multi({ label, options, value, onChange }: { label: string; options: ReportOption[]; value: string[]; onChange: (value: string[]) => void }) {
    const [search, setSearch] = useState('');
    return <details className="report-multi"><summary>{label}{value.length ? ` (${value.length})` : ''}</summary>
        <input className="form-control" type="search" aria-label={`Поиск: ${label}`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск…" />
        <div className="report-choices">{options.filter(o => o.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(o => <label key={o.id}>
            <input type="checkbox" checked={value.includes(o.id)} onChange={e => onChange(e.target.checked ? [...value, o.id] : value.filter(id => id !== o.id))} />{o.name}</label>)}</div>
    </details>;
}
function Details({ entry: e }: { entry: ReportEntry }) {
    return <details className="report-details"><summary>Комментарии ({e.comments.length}) и подробности</summary>
        <dl><dt>Исходный комментарий</dt><dd>{e.initialComment || 'Не указан'}</dd></dl>
        {e.points.map((p, n) => <div key={`${p.id}-${n}`}><h4>{p.name}</h4><p>{p.comment || 'Без комментария'}</p></div>)}
        {e.comments.length > 0 && <ol>{e.comments.map((c, n) => <li key={n}><div className="subtle">{time(c.occurredAt)} МСК · {c.author} · {c.source}</div><p>{c.text}</p></li>)}</ol>}
        {(e.cancellationReason || e.status === 'CANCELLED') && <div className="report-cancellation"><h4>Причина отмены</h4><p>{e.cancellationReason || 'Причина не указана'}</p></div>}
        {e.resolutionComment && <><h4>Комментарий закрытия</h4><p>{e.resolutionComment}</p></>}
    </details>;
}
export function ObjectReportsPage() {
    const { user } = useAuthContext();
    const [params, setParams] = useSearchParams();
    const [draft, setDraft] = useState<Draft>(() => read(params));
    const [error, setError] = useState('');
    const [objectSearch, setObjectSearch] = useState('');
    const serialized = params.toString();
    useEffect(() => { setDraft(read(new URLSearchParams(serialized))); setError(''); }, [serialized]);
    const options = useQuery({ queryKey: ['object-report-options', user?.id], queryFn: ({ signal }) => objectReportsApi.options(signal), enabled: !!user, retry: false });
    const report = useQuery({ queryKey: ['object-report', user?.id, serialized], queryFn: ({ signal }) => objectReportsApi.list(new URLSearchParams(serialized), signal), enabled: !!user, retry: false });
    const data = report.isError ? undefined : report.data;
    function apply(event: FormEvent) {
        event.preventDefault();
        const from = draft.from ? fromZonedTime(draft.from, 'Europe/Moscow') : null;
        const to = draft.to ? fromZonedTime(draft.to, 'Europe/Moscow') : null;
        if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) { setError('Проверьте начало и окончание периода.'); return; }
        const next = new URLSearchParams();
        if (draft.objectId === 'unassigned') next.set('unassigned', 'true'); else if (draft.objectId) next.set('objectId', draft.objectId);
        for (const key of ['kind', 'createdBy', 'search', 'sort'] as const) if (draft[key].trim()) next.set(key, draft[key].trim());
        for (const key of ['categoryIds', 'checklistItemIds', 'statuses'] as const) for (const value of draft[key]) next.append(key, value);
        if (from) next.set('eventFrom', from.toISOString()); if (to) next.set('eventTo', to.toISOString());
        next.set('page', '0'); next.set('size', params.get('size') ?? '25'); setError(''); setParams(next);
    }
    function page(value: number, size?: string) { const next = new URLSearchParams(params); next.set('page', String(Math.max(0, value))); if (size) next.set('size', size); setParams(next); }
    function reset() { setParams(new URLSearchParams()); setDraft(read(new URLSearchParams())); setObjectSearch(''); setError(''); }
    return <><Header /><div className="app-body"><Sidebar /><main className="workspace report-workspace">
        <div className="page-heading"><div><div className="breadcrumb-line">Ситуационный центр / Отчёты</div><h1>События и нарушения по объектам</h1></div>
            <div className="report-actions"><button className="btn btn-outline-secondary" disabled title="Серверный экспорт PDF ещё не подключён">↓ PDF</button><button className="btn btn-outline-secondary" disabled title="Серверный экспорт Excel ещё не подключён">↓ Excel</button></div></div>
        <section className="panel report-panel">
            <form onSubmit={apply} className="report-filters">
                <label>Объект<input className="form-control" type="search" aria-label="Поиск объекта" placeholder="Найти объект…" value={objectSearch} onChange={e => setObjectSearch(e.target.value)} />
                    <select className="form-control" value={draft.objectId} onChange={e => setDraft(d => ({ ...d, objectId: e.target.value }))}><option value="">Все объекты</option><option value="unassigned">Объект не определён</option>{options.data?.objects.filter(o => o.id === draft.objectId || o.name.toLocaleLowerCase().includes(objectSearch.toLocaleLowerCase())).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                <label>С (МСК)<input className="form-control" type="datetime-local" step="1" value={draft.from} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} /></label>
                <label>По (МСК, включительно)<input className="form-control" type="datetime-local" step="1" value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} /></label>
                <label>Тип<select className="form-control" value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value }))}><option value="">Все</option><option value="EVENT">События</option><option value="VIOLATION">Нарушения</option></select></label>
                <label>Оператор<select className="form-control" value={draft.createdBy} onChange={e => setDraft(d => ({ ...d, createdBy: e.target.value }))}><option value="">Все</option>{options.data?.operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                <label className="report-search">Поиск<input className="form-control" type="search" maxLength={500} placeholder="Номер, категория, точка, комментарий, причина отмены…" value={draft.search} onChange={e => setDraft(d => ({ ...d, search: e.target.value }))} /></label>
                <Multi label="Категории" options={options.data?.categories ?? []} value={draft.categoryIds} onChange={value => setDraft(d => ({ ...d, categoryIds: value, checklistItemIds: [] }))} />
                <Multi label="Контрольные точки" options={(options.data?.checkpoints ?? []).filter(o => !draft.categoryIds.length || draft.categoryIds.includes(o.parentId ?? ''))} value={draft.checklistItemIds} onChange={value => setDraft(d => ({ ...d, checklistItemIds: value }))} />
                <Multi label="Статусы" options={Object.entries(statuses).map(([id, name]) => ({ id, name, parentId: null }))} value={draft.statuses} onChange={value => setDraft(d => ({ ...d, statuses: value }))} />
                <label>Сортировка<select className="form-control" value={draft.sort} onChange={e => setDraft(d => ({ ...d, sort: e.target.value }))}><option value="eventTime,desc">Сначала новые события</option><option value="eventTime,asc">Сначала старые события</option><option value="createdAt,desc">По регистрации</option><option value="objectName,asc">По объектам</option></select></label>
                <div className="report-actions"><button className="btn btn-primary" type="submit">Применить</button><button className="btn btn-outline-secondary" type="button" onClick={reset}>Сбросить</button></div>
                <p className="subtle report-hint">Время — МСК. Оператор — автор создания записи. Фильтры применяются кнопкой «Применить» или Enter. PDF/Excel будут доступны после подключения серверного экспорта.</p>
                {error && <p role="alert" className="report-error">{error}</p>}
                {options.isError && <p role="alert" className="report-error">Не удалось загрузить фильтры. <button type="button" className="btn btn-outline-secondary" onClick={() => void options.refetch()}>Повторить</button></p>}
            </form>
            {report.isError && <p role="alert" className="report-error">{isAxiosError(report.error) && report.error.response?.status === 403 ? 'Нет права incident:read.' : 'Не удалось загрузить отчёт. Проверьте параметры и доступность сервера.'} <button className="btn btn-outline-secondary" onClick={() => void report.refetch()}>Повторить</button></p>}
            <div className="report-scroll" aria-busy={report.isFetching}><table className="report-table"><caption>Найдено записей: {data?.totalElements ?? '—'}</caption>
                <thead><tr>{['Объект / номер', 'Время события / регистрации (МСК)', 'Тип / категория', 'Контрольные точки', 'Статус', 'Оператор', 'Комментарии'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
                <tbody>{report.isPending && <tr><td colSpan={7}>Загрузка…</td></tr>}{data && !data.content.length && <tr><td colSpan={7}>По выбранным условиям записей нет.</td></tr>}
                    {data?.content.map(e => <tr key={e.id}>
                        <td data-label="Объект / номер"><span>{e.objectName}</span><strong>{e.number}</strong>{!e.objectId && <small>Нет однозначной привязки к объекту</small>}</td>
                        <td data-label="Время события / регистрации"><time dateTime={e.eventTime}>{time(e.eventTime)}</time><small>Рег.: {time(e.createdAt)}</small></td>
                        <td data-label="Тип / категория"><span>{e.kind === 'VIOLATION' ? 'Нарушение' : 'Событие'}</span><small>{e.category}</small></td>
                        <td data-label="Контрольные точки">{e.points.length ? <ul>{e.points.map((point, n) => <li key={n}>{point.name}</li>)}</ul> : 'Не указана'}</td>
                        <td data-label="Статус"><span className={`report-status ${e.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>{statuses[e.status] ?? e.status}</span>{(e.cancellationReason || e.status === 'CANCELLED') && <small>Причина отмены: {e.cancellationReason || 'не указана'}</small>}</td>
                        <td data-label="Оператор">{e.operatorName}</td><td data-label="Комментарии"><p className="report-excerpt">{e.initialComment || 'Без комментария'}</p><Details entry={e} /></td>
                    </tr>)}</tbody></table></div>
            <footer className="report-pagination"><span role="status">{report.isFetching ? 'Обновление…' : data ? `Всего ${data.totalElements}; страница ${data.totalPages ? data.page + 1 : 0} из ${data.totalPages}` : 'Данные недоступны'}</span>
                <label>Строк<select className="form-control" value={params.get('size') ?? '25'} disabled={report.isFetching} onChange={e => page(0, e.target.value)}>{[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                <button className="btn btn-outline-secondary" aria-label="Первая страница" disabled={!data || data.page === 0 || report.isFetching} onClick={() => page(0)}>«</button>
                <button className="btn btn-outline-secondary" disabled={!data || data.page === 0 || report.isFetching} onClick={() => page((data?.page ?? 0) - 1)}>Назад</button>
                <button className="btn btn-outline-secondary" disabled={!data || data.page + 1 >= data.totalPages || report.isFetching} onClick={() => page((data?.page ?? 0) + 1)}>Далее</button>
                <button className="btn btn-outline-secondary" aria-label="Последняя страница" disabled={!data || data.page + 1 >= data.totalPages || report.isFetching} onClick={() => page((data?.totalPages ?? 1) - 1)}>»</button>
            </footer>
        </section></main></div></>;
}
