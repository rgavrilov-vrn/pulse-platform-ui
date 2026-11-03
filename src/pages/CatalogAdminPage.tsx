import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ActionDialog } from '../components/ActionDialog';
import { useAuthContext } from '../auth/AuthContext';
import { catalogApi } from '../api/catalog';
import { catalogAdminApi, type CategoryInput, type PointInput, type ManagedCategory, type ManagedPoint } from '../api/catalogAdmin';
import type { IncidentSeverity } from '../api/types';
import './CatalogAdminPage.css';

type Editor = { type: 'category'; id?: string; body: CategoryInput } | { type: 'point'; id?: string; body: PointInput };
type DeleteTarget = { type: 'category'; row: ManagedCategory } | { type: 'point'; row: ManagedPoint };
const priorities: Record<IncidentSeverity, string> = { LOW: 'Низкий', MEDIUM: 'Средний', HIGH: 'Высокий', CRITICAL: 'Критический' };
function message(error: unknown): string {
    if (isAxiosError(error)) {
        if (error.response?.status === 403) return 'Недостаточно прав для работы со справочниками.';
        const body = error.response?.data;
        return typeof body?.detail === 'string' ? body.detail : typeof body?.message === 'string' ? body.message : error.message;
    }
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию.';
}
export function CatalogAdminPage() {
    const { user, hasAuthority } = useAuthContext();
    const canRead = hasAuthority('incident_catalog:read');
    const canManage = hasAuthority('incident_catalog:manage');
    const qc = useQueryClient();
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [groupId, setGroupId] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [pointSearch, setPointSearch] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [editor, setEditor] = useState<Editor | null>(null);
    const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const writing = useRef(false);
    const groups = useQuery({ queryKey: ['catalog-admin', user?.id, 'groups'], queryFn: catalogApi.groups, enabled: canRead, retry: false });
    const categories = useQuery({ queryKey: ['catalog-admin', user?.id, 'categories', includeDeleted], queryFn: ({ signal }) => catalogAdminApi.categories(includeDeleted, signal), enabled: canRead, retry: false });
    const visible = (categories.isError ? [] : categories.data ?? []).filter(c => (!groupId || c.groupId === groupId) && `${c.name} ${c.code}`.toLocaleLowerCase().includes(categorySearch.toLocaleLowerCase()));
    const category = visible.find(c => c.id === selectedId) ?? visible[0];
    const points = useQuery({ queryKey: ['catalog-admin', user?.id, 'points', category?.id, includeDeleted], queryFn: ({ signal }) => catalogAdminApi.points(category!.id, includeDeleted, signal), enabled: canRead && !!category, retry: false });
    const visiblePoints = (points.isError ? [] : points.data ?? []).filter(p => `${p.name} ${p.code}`.toLocaleLowerCase().includes(pointSearch.toLocaleLowerCase()));
    const loaded = !categories.isFetching && !categories.isError && !groups.isFetching && !groups.isError;
    function discard(): boolean { return !editor || window.confirm('Закрыть форму без сохранения изменений?'); }
    function open(next: Editor) { if (!busy && discard()) { setEditor(next); setError(''); } }
    function newCategory() {
        const parent = groupId || groups.data?.[0]?.id || '';
        open({ type: 'category', body: { groupId: parent, code: '', name: '', description: '', sortOrder: 0 } });
    }
    function newPoint() {
        if (!category?.active) return;
        open({ type: 'point', body: { categoryId: category.id, code: '', name: '', description: '', commentTemplate: '', defaultSeverity: 'MEDIUM', sortOrder: 0, requiresImage: false, requiresComment: false, requiresVideo: false } });
    }
    async function write(action: () => Promise<unknown>, success: string): Promise<boolean> {
        if (writing.current || !canManage) return false;
        writing.current = true; setBusy(true); setError('');
        try {
            await action();
            await Promise.all(['catalog-admin', 'catalog', 'incidents', 'incident', 'object-report-options', 'object-report', 'audit'].map(key => qc.invalidateQueries({ queryKey: [key] })));
            toast.success(success); return true;
        } catch (cause) { setError(message(cause)); return false; }
        finally { writing.current = false; setBusy(false); }
    }
    async function save(event: FormEvent) {
        event.preventDefault();
        if (!editor || busy) return;
        const current = editor;
        const body = { ...current.body, code: current.body.code.trim(), name: current.body.name.trim() };
        if (!body.code || !body.name || !Number.isInteger(body.sortOrder) || body.sortOrder < 0) { setError('Укажите код, название и целый неотрицательный порядок сортировки.'); return; }
        let ok: boolean;
        if (current.type === 'category') {
            const payload = { ...current.body, code: body.code, name: body.name };
            if (!payload.groupId) { setError('Выберите тип события.'); return; }
            ok = await write(() => current.id ? catalogAdminApi.updateCategory(current.id, payload) : catalogAdminApi.createCategory(payload), 'Категория сохранена');
        } else {
            const payload = { ...current.body, code: body.code, name: body.name };
            ok = await write(() => current.id ? catalogAdminApi.updatePoint(current.id, payload) : catalogAdminApi.createPoint(payload), 'Контрольная точка сохранена');
        }
        if (ok) setEditor(null);
    }
    async function remove(target: DeleteTarget) {
        setDeleting(null);
        if (!discard()) return;
        const ok = await write(() => target.type === 'category' ? catalogAdminApi.deleteCategory(target.row.id) : catalogAdminApi.deletePoint(target.row.id), target.type === 'category' ? 'Категория и её контрольные точки удалены' : 'Контрольная точка удалена');
        if (ok) setEditor(null);
    }
    const groupName = (id: string) => groups.data?.find(g => g.id === id)?.name ?? 'Тип не найден';
    const queryError = groups.error ?? categories.error ?? points.error;
    return <><Header /><div className="app-body"><Sidebar /><main className="workspace catalog-workspace">
        <div className="page-heading"><div><div className="breadcrumb-line">Ситуационный центр / Справочники</div><h1>Категории и контрольные точки</h1></div></div>
        {!canRead ? <section className="panel catalog-panel" role="alert">Нет права incident_catalog:read.</section> : <>
            <section className="panel catalog-toolbar">
                <label>Тип события<select className="form-control" value={groupId} disabled={busy} onChange={e => { if (discard()) { setEditor(null); setGroupId(e.target.value); setSelectedId(''); } }}><option value="">Все типы</option>{groups.data?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
                <label className="catalog-check"><input type="checkbox" checked={includeDeleted} disabled={busy} onChange={e => { if (discard()) { setEditor(null); setIncludeDeleted(e.target.checked); } }} />Показать удалённые</label>
                {!canManage && <span className="subtle">Только просмотр. Для изменений требуется incident_catalog:manage.</span>}
            </section>
            {(error || queryError) && <section className="panel catalog-panel catalog-error" role="alert">{error || message(queryError)}{queryError && <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => { void groups.refetch(); void categories.refetch(); if (category) void points.refetch(); }}>Повторить загрузку</button>}</section>}
            <div className="catalog-columns">
                <section className="panel catalog-panel">
                    <div className="catalog-section-heading"><h2>Категории</h2>{canManage && <button type="button" className="btn btn-primary" disabled={busy || !loaded || !groups.data?.length} onClick={newCategory}>Добавить категорию</button>}</div>
                    <input className="form-control" type="search" aria-label="Поиск категории" placeholder="Название или код категории" value={categorySearch} disabled={busy} onChange={e => { if (discard()) { setEditor(null); setCategorySearch(e.target.value); } }} />
                    {categories.isPending && <p role="status">Загрузка категорий…</p>}
                    {!categories.isPending && !categories.isError && !visible.length && <p className="subtle">Категорий по выбранным условиям нет.</p>}
                    <ul className="catalog-category-list">{visible.map(c => <li key={c.id} className={`${c.id === category?.id ? 'is-selected' : ''} ${!c.active ? 'is-deleted' : ''}`}>
                        <button type="button" className="catalog-category-select" disabled={busy} aria-pressed={c.id === category?.id} onClick={() => { if (discard()) { setEditor(null); setSelectedId(c.id); setPointSearch(''); } }}><span>{c.name}</span><small>{groupName(c.groupId)} · {c.code}{!c.active ? ' · Удалена' : ''}</small></button>
                        {canManage && c.active && <div className="catalog-row-actions"><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => open({ type: 'category', id: c.id, body: { groupId: c.groupId, code: c.code, name: c.name, description: c.description ?? '', sortOrder: c.sortOrder } })}>Изменить</button><button type="button" className="btn btn-outline-danger" disabled={busy || !loaded} onClick={() => setDeleting({ type: 'category', row: c })}>Удалить</button></div>}
                    </li>)}</ul>
                </section>
                <section className="panel catalog-panel">
                    <div className="catalog-section-heading"><div><h2>Контрольные точки</h2><span className="subtle">{category?.name ?? 'Выберите категорию'}</span></div>{canManage && <button type="button" className="btn btn-primary" disabled={busy || !loaded || !category?.active} onClick={newPoint}>Добавить точку</button>}</div>
                    {category && <><input className="form-control" type="search" aria-label="Поиск контрольной точки" placeholder="Название или код контрольной точки" value={pointSearch} onChange={e => setPointSearch(e.target.value)} />
                        {!category.active && <p className="subtle">Категория удалена. Создание и редактирование точек недоступны.</p>}
                        {points.isPending && <p role="status">Загрузка контрольных точек…</p>}
                        <div className="catalog-table-scroll" aria-busy={points.isFetching}><table className="catalog-table"><thead><tr><th>Название / код</th><th>Приоритет</th><th>Состояние</th>{canManage && <th>Действия</th>}</tr></thead><tbody>
                            {visiblePoints.map(p => <tr key={p.id} className={!p.active ? 'is-deleted' : ''}><td><span>{p.name}</span><small>{p.code}</small></td><td>{priorities[p.defaultSeverity] ?? p.defaultSeverity}</td><td>{p.active ? 'Активна' : 'Удалена'}</td>{canManage && <td>{p.active && category.active && <div className="catalog-row-actions"><button type="button" className="btn btn-outline-secondary" disabled={busy || points.isFetching} onClick={() => open({ type: 'point', id: p.id, body: { categoryId: p.categoryId, code: p.code, name: p.name, description: p.description ?? '', commentTemplate: p.commentTemplate ?? '', defaultSeverity: p.defaultSeverity, sortOrder: p.sortOrder, requiresImage: p.requiresImage, requiresComment: p.requiresComment, requiresVideo: p.requiresVideo } })}>Изменить</button><button type="button" className="btn btn-outline-danger" disabled={busy || points.isFetching} onClick={() => setDeleting({ type: 'point', row: p })}>Удалить</button></div>}</td>}</tr>)}
                            {!points.isPending && !points.isError && !visiblePoints.length && <tr><td colSpan={canManage ? 4 : 3}>Контрольных точек по выбранным условиям нет.</td></tr>}
                        </tbody></table></div></>}
                </section>
            </div>
            {editor && canManage && <section className="panel catalog-panel catalog-editor"><h2>{editor.id ? 'Редактирование' : 'Создание'} {editor.type === 'category' ? 'категории' : 'контрольной точки'}</h2>
                <form onSubmit={event => void save(event)}><fieldset disabled={busy}>
                    <div className="catalog-form-grid">
                        {editor.type === 'category' ? <label>Тип события<select required className="form-control" disabled={!!editor.id} value={editor.body.groupId} onChange={e => setEditor({ ...editor, body: { ...editor.body, groupId: e.target.value } })}><option value="">Выберите тип</option>{groups.data?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label> : <label>Категория<input className="form-control" readOnly value={categories.data?.find(c => c.id === editor.body.categoryId)?.name ?? editor.body.categoryId} /></label>}
                        <label>Код<input className="form-control" required maxLength={100} readOnly={!!editor.id} value={editor.body.code} onChange={e => setEditor({ ...editor, body: { ...editor.body, code: e.target.value } })} /></label>
                        <label>Название<input className="form-control" required maxLength={editor.type === 'category' ? 255 : 500} value={editor.body.name} onChange={e => setEditor({ ...editor, body: { ...editor.body, name: e.target.value } })} /></label>
                        <label>Порядок сортировки<input className="form-control" type="number" min={0} max={2147483647} step={1} required value={editor.body.sortOrder} onChange={e => setEditor({ ...editor, body: { ...editor.body, sortOrder: Number(e.target.value) } })} /></label>
                    </div>
                    <label>Описание<textarea className="form-control" rows={3} maxLength={10000} value={editor.body.description} onChange={e => setEditor({ ...editor, body: { ...editor.body, description: e.target.value } })} /></label>
                    {editor.type === 'point' && <>
                        <label>Шаблон комментария<textarea className="form-control" rows={3} maxLength={10000} value={editor.body.commentTemplate} onChange={e => setEditor({ ...editor, body: { ...editor.body, commentTemplate: e.target.value } })} /></label>
                        <label>Приоритет по умолчанию<select className="form-control" value={editor.body.defaultSeverity} onChange={e => setEditor({ ...editor, body: { ...editor.body, defaultSeverity: e.target.value as IncidentSeverity } })}>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <div className="catalog-requirements">{(['requiresImage', 'requiresComment', 'requiresVideo'] as const).map((key, index) => <label className="catalog-check" key={key}><input type="checkbox" checked={editor.body[key]} onChange={e => setEditor({ ...editor, body: { ...editor.body, [key]: e.target.checked } })} />{['Требуется изображение', 'Требуется комментарий', 'Требуется видео'][index]}</label>)}</div>
                    </>}
                    <p className="subtle">Код и принадлежность к типу/категории после создания не изменяются. Удалённые коды повторно не используются.</p>
                    <div className="catalog-row-actions"><button className="btn btn-primary" type="submit">{busy ? 'Сохранение…' : 'Сохранить'}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { if (discard()) { setEditor(null); setError(''); } }}>Отмена</button></div>
                </fieldset></form>
            </section>}
            <p className="subtle">Удаление мягкое: ранее зарегистрированные события и их связи сохраняются. Удаление категории также удаляет все её активные контрольные точки.</p>
        </>}
        {deleting && <ActionDialog title={deleting.type === 'category' ? 'Удалить категорию и все её точки?' : 'Удалить контрольную точку?'} description={deleting.type === 'category' ? `Категория «${deleting.row.name}» и все её активные контрольные точки будут деактивированы одной операцией. Ранее зарегистрированные события сохранятся.` : `Контрольная точка «${deleting.row.name}» больше не будет доступна для новых привязок. Существующие связи сохранятся.`} confirmLabel="Удалить" onCancel={() => setDeleting(null)} onConfirm={() => { if (!writing.current) void remove(deleting); }} />}
    </main></div></>;
}
