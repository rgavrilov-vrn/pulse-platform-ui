import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ReportExportButtons } from '../components/ReportExportButtons';
import { DataPagination } from '../components/DataPagination';
import { useAuthContext } from '../auth/AuthContext';
import { objectReportsApi, type ReportEntry, type ReportOption } from '../api/objectReports';
import './AuditPage.css';
import './ObjectReportsPage.css';

const statuses: Record<string, string> = { DRAFT: 'Черновик', RECORDED: 'Зарегистрировано', NEEDS_REVIEW: 'На рассмотрении', CONFIRMED: 'Подтверждено', REJECTED: 'Отклонено', CLOSED: 'Закрыто', CANCELLED: 'Отменено', ARCHIVED: 'В архиве' };
const time = (value: string | null) => value && !Number.isNaN(new Date(value).getTime()) ? formatInTimeZone(value, 'Europe/Moscow', 'dd.MM.yyyy HH:mm:ss') : '—';
const inputTime = (value: string | null) => value && !Number.isNaN(new Date(value).getTime()) ? formatInTimeZone(value, 'Europe/Moscow', "yyyy-MM-dd'T'HH:mm:ss") : '';
const hasText = (value: string | null | undefined) => !!value?.trim();
function commentCount(entry: ReportEntry): number {
    const comments = entry.comments.filter(comment => hasText(comment.text));
    const representedByTransition = (status: string, text: string | null) => {
        const transition = comments.filter(comment => comment.source.startsWith('STATUS:') && comment.source.trim().endsWith(`→ ${status}`)).at(-1);
        return !!transition && transition.text.trim() === text?.trim();
    };
    return Number(hasText(entry.initialComment)) + comments.length
        + entry.points.filter(point => hasText(point.comment)).length
        + Number(hasText(entry.cancellationReason) && !representedByTransition('CANCELLED', entry.cancellationReason))
        + Number(hasText(entry.resolutionComment) && !representedByTransition('CLOSED', entry.resolutionComment));
}
function reportErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 403) return 'HTTP 403: нет права incident:read.';
        if (status === 404) return 'HTTP 404: API отчёта не найден. Проверьте версию backend.';
        const body: unknown = error.response?.data;
        let detail = '';
        if (body && typeof body === 'object') {
            const problem = body as Record<string, unknown>;
            detail = typeof problem.detail === 'string' ? problem.detail : typeof problem.message === 'string' ? problem.message : '';
        }
        const message = (detail || error.message || 'Неизвестная ошибка').slice(0, 1500);
        if (status) return `Не удалось загрузить отчёт. HTTP ${status}: ${message}`;
        return `${error.request ? 'Ошибка соединения' : 'Ошибка подготовки запроса'}: ${message}`;
    }
    return error instanceof Error ? `Ошибка выполнения запроса: ${error.message.slice(0, 1500)}` : 'Не удалось загрузить отчёт: неизвестная ошибка.';
}
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
    const comments = e.comments.filter(comment => hasText(comment.text));
    return <details className="report-details"><summary>Комментарии ({commentCount(e)}) и подробности</summary>
        <dl><dt>Исходный комментарий</dt><dd>{hasText(e.initialComment) ? e.initialComment : 'Не указан'}</dd></dl>
        {e.points.map((p, n) => <div key={`${p.id}-${n}`}><h4>{p.name}</h4><p>{hasText(p.comment) ? p.comment : 'Без комментария'}</p></div>)}
        {comments.length > 0 && <ol>{comments.map((c, n) => <li key={n}><div className="subtle">{time(c.occurredAt)} МСК · {c.author} · {c.source}</div><p>{c.text}</p></li>)}</ol>}
        {(hasText(e.cancellationReason) || e.status === 'CANCELLED') && <div className="report-cancellation"><h4>Причина отмены</h4><p>{hasText(e.cancellationReason) ? e.cancellationReason : 'Причина не указана'}</p></div>}
        {hasText(e.resolutionComment) && <><h4>Комментарий закрытия</h4><p>{e.resolutionComment}</p></>}
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
    useEffect(() => {
        if (!report.data || report.isFetching || report.isError) return;
        const last = Math.max(0, report.data.totalPages - 1);
        if (report.data.page > last) {
            const next = new URLSearchParams(serialized); next.set('page', String(last)); setParams(next, { replace: true });
        }
    }, [report.data, report.isFetching, report.isError, serialized, setParams]);
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
        next.set('page', '0'); next.set('size', params.get('size') ?? '25'); setError('');
        if (next.toString() === serialized) {
            if (!report.isFetching) void report.refetch();
        } else {
            setParams(next);
        }
    }
    function page(value: number, size?: number) { const next = new URLSearchParams(params); next.set('page', String(Math.max(0, value))); if (size) next.set('size', String(size)); setParams(next); }
    function reset() { const next = new URLSearchParams(); next.set('size', params.get('size') ?? '25'); next.set('page', '0'); setParams(next); setDraft(read(next)); setObjectSearch(''); setError(''); }
    return <><Header /><div className="app-body"><Sidebar /><main className="workspace report-workspace">
        <div className="page-heading"><div><div className="breadcrumb-line">Ситуационный центр / Отчёты</div><h1>События и нарушения по объектам</h1></div>
            <ReportExportButtons params={params} disabled={!data || report.isFetching} /></div>
        <section className="panel report-panel">
            <form onSubmit={apply} className="audit-filters">
                <label className="audit-search">Поиск по всему отчёту<input className="form-control" type="search" maxLength={500} placeholder="Номер, категория, точка, комментарий, причина отмены…" value={draft.search} onChange={e => setDraft(d => ({ ...d, search: e.target.value }))} /></label>
                <details className="audit-filter-details"><summary>Точные фильтры и период</summary>
                    <div className="audit-filter-grid">
                        <label>Объект<input className="form-control" type="search" aria-label="Поиск объекта" placeholder="Найти объект…" value={objectSearch} onChange={e => setObjectSearch(e.target.value)} />
                            <select className="form-control" value={draft.objectId} onChange={e => setDraft(d => ({ ...d, objectId: e.target.value }))}><option value="">Все объекты</option><option value="unassigned">Объект не определён</option>{options.data?.objects.filter(o => o.id === draft.objectId || o.name.toLocaleLowerCase().includes(objectSearch.toLocaleLowerCase())).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                        <label>С (МСК)<input className="form-control" type="datetime-local" step="1" value={draft.from} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} /></label>
                        <label>По (МСК, включительно)<input className="form-control" type="datetime-local" step="1" value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} /></label>
                        <label>Тип<select className="form-control" value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value }))}><option value="">Все</option><option value="EVENT">События</option><option value="VIOLATION">Нарушения</option></select></label>
                        <label>Оператор<select className="form-control" value={draft.createdBy} onChange={e => setDraft(d => ({ ...d, createdBy: e.target.value }))}><option value="">Все</option>{options.data?.operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                        <Multi label="Категории" options={options.data?.categories ?? []} value={draft.categoryIds} onChange={value => setDraft(d => ({ ...d, categoryIds: value, checklistItemIds: [] }))} />
                        <Multi label="Контрольные точки" options={(options.data?.checkpoints ?? []).filter(o => !draft.categoryIds.length || draft.categoryIds.includes(o.parentId ?? ''))} value={draft.checklistItemIds} onChange={value => setDraft(d => ({ ...d, checklistItemIds: value }))} />
                        <Multi label="Статусы" options={Object.entries(statuses).map(([id, name]) => ({ id, name, parentId: null }))} value={draft.statuses} onChange={value => setDraft(d => ({ ...d, statuses: value }))} />
                    </div>
                </details>
                <div className="audit-filter-actions"><label>Сортировка<select className="form-control" value={draft.sort} onChange={e => setDraft(d => ({ ...d, sort: e.target.value }))}><option value="eventTime,desc">Сначала новые события</option><option value="eventTime,asc">Сначала старые события</option><option value="createdAt,desc">По регистрации</option><option value="objectName,asc">По объектам</option></select></label>
                    <button className="btn btn-primary" type="submit">Применить</button><button className="btn btn-outline-secondary" type="button" onClick={reset}>Сбросить</button><span className="subtle">Поиск и фильтры применяются кнопкой «Применить» или Enter.</span></div>
                <p className="subtle report-hint">Время — МСК. Оператор — автор создания записи. PDF/Excel содержат всю выборку по применённым фильтрам, а не только текущую страницу.</p>
                {error && <p role="alert" className="report-error">{error}</p>}
                {options.isError && <p role="alert" className="report-error">Не удалось загрузить фильтры. <button type="button" className="btn btn-outline-secondary" onClick={() => void options.refetch()}>Повторить</button></p>}
            </form>
            {report.isError && <p role="alert" className="report-error">{reportErrorMessage(report.error)} <button type="button" className="btn btn-outline-secondary" disabled={report.isFetching} onClick={() => void report.refetch()}>Повторить</button></p>}
            <div className="report-scroll" aria-busy={report.isFetching}><table className="report-table"><caption>Найдено записей: {data?.totalElements ?? '—'}</caption>
                <thead><tr>{['Объект / номер', 'Время события / регистрации (МСК)', 'Тип / категория', 'Контрольные точки', 'Статус', 'Оператор', 'Комментарии'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
                <tbody>{report.isPending && <tr><td colSpan={7}>Загрузка…</td></tr>}{data && !data.content.length && <tr><td colSpan={7}>По выбранным условиям записей нет.</td></tr>}
                    {data?.content.map(e => <tr key={e.id}>
                        <td data-label="Объект / номер"><span>{e.objectName}</span><strong>{e.number}</strong>{!e.objectId && <small>Нет однозначной привязки к объекту</small>}</td>
                        <td data-label="Время события / регистрации"><time dateTime={e.eventTime}>{time(e.eventTime)}</time><small>Рег.: {time(e.createdAt)}</small></td>
                        <td data-label="Тип / категория"><span>{e.kind === 'VIOLATION' ? 'Нарушение' : 'Событие'}</span><small>{e.category}</small></td>
                        <td data-label="Контрольные точки">{e.points.length ? <ul>{e.points.map((point, n) => <li key={n}>{point.name}</li>)}</ul> : 'Не указана'}</td>
                        <td data-label="Статус"><span className={`report-status ${e.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>{statuses[e.status] ?? e.status}</span>{(hasText(e.cancellationReason) || e.status === 'CANCELLED') && <small>Причина отмены: {hasText(e.cancellationReason) ? e.cancellationReason : 'не указана'}</small>}</td>
                        <td data-label="Оператор">{e.operatorName}</td><td data-label="Комментарии"><p className="report-excerpt">{hasText(e.initialComment) ? e.initialComment : 'Без комментария'}</p><Details entry={e} /></td>
                    </tr>)}</tbody></table></div>
            <DataPagination page={data?.page ?? Number(params.get('page') ?? 0)} size={data?.size ?? Number(params.get('size') ?? 25)} totalElements={data?.totalElements} totalPages={data?.totalPages} rowCount={data?.content.length ?? 0} loading={report.isFetching} label="Страницы отчёта по объектам" onPageChange={value => page(value)} onSizeChange={size => page(0, size)} />
        </section></main></div></>;
}
