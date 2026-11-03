import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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

type Draft = CategoryInput & PointInput;
interface Editor { type: 'category' | 'point'; id?: string; readOnly: boolean; body: Draft }
type DeleteTarget = { type: 'category'; row: ManagedCategory } | { type: 'point'; row: ManagedPoint };
const priorities: Record<IncidentSeverity, string> = { LOW: 'Низкий', MEDIUM: 'Средний', HIGH: 'Высокий', CRITICAL: 'Критический' };
function emptyDraft(): Draft {
    return { groupId: '', categoryId: '', code: '', name: '', description: '', sortOrder: 0,
        commentTemplate: '', defaultSeverity: 'MEDIUM', requiresImage: false, requiresComment: false, requiresVideo: false };
}
function message(error: unknown): string {
    if (isAxiosError(error)) {
        if (error.response?.status === 403) return 'Недостаточно прав для работы со справочниками.';
        const body = error.response?.data;
        return typeof body?.detail === 'string' ? body.detail : typeof body?.message === 'string' ? body.message : error.message;
    }
    return error instanceof Error ? error.message : 'Не удалось выполнить операцию.';
}
function TrashButton({ name, disabled, onClick }: { name: string; disabled: boolean; onClick: () => void }) {
    return <button type="button" className="catalog-delete-icon" title={`Удалить «${name}»`} aria-label={`Удалить «${name}»`} disabled={disabled}
        onClick={event => { event.stopPropagation(); onClick(); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>;
}
function RestoreButton({ name, disabled, reason, onClick }: { name: string; disabled: boolean; reason?: string; onClick: () => void }) {
    return <button type="button" className="catalog-restore-icon" title={reason ?? `Восстановить «${name}»`} aria-label={`Восстановить «${name}»`} disabled={disabled}
        onClick={event => { event.stopPropagation(); onClick(); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6M12 8v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>;
}
function CatalogCard({ title, busy, onClose, children, footer }: { title: string; busy: boolean; onClose: () => void; children: ReactNode; footer: ReactNode }) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal(); return () => dialog?.close(); }, []);
    return <dialog ref={ref} className="catalog-card-dialog" aria-labelledby="catalog-card-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
        <header className="catalog-card-heading"><h2 id="catalog-card-title">{title}</h2><button type="button" className="catalog-close-icon" aria-label="Закрыть карточку" title="Закрыть" disabled={busy} onClick={onClose}>×</button></header>
        <div className="catalog-card-body">{children}</div><footer className="catalog-card-actions">{footer}</footer>
    </dialog>;
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
    const [restoring, setRestoring] = useState<DeleteTarget | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const writing = useRef(false);
    const original = useRef('');
    const groups = useQuery({ queryKey: ['catalog-admin', user?.id, 'groups'], queryFn: catalogApi.groups, enabled: canRead, retry: false });
    const categories = useQuery({ queryKey: ['catalog-admin', user?.id, 'categories', includeDeleted], queryFn: ({ signal }) => catalogAdminApi.categories(includeDeleted, signal), enabled: canRead, retry: false });
    const visible = (categories.isError ? [] : categories.data ?? []).filter(c => (!groupId || c.groupId === groupId) && `${c.name} ${c.code}`.toLocaleLowerCase().includes(categorySearch.toLocaleLowerCase()));
    const category = visible.find(c => c.id === selectedId) ?? visible[0];
    const points = useQuery({ queryKey: ['catalog-admin', user?.id, 'points', category?.id, includeDeleted], queryFn: ({ signal }) => catalogAdminApi.points(category!.id, includeDeleted, signal), enabled: canRead && !!category, retry: false });
    const visiblePoints = (points.isError ? [] : points.data ?? []).filter(p => `${p.name} ${p.code}`.toLocaleLowerCase().includes(pointSearch.toLocaleLowerCase()));
    const loaded = !categories.isFetching && !categories.isError && !groups.isFetching && !groups.isError;
    const editable = !!editor && canManage && !editor.readOnly;
    function discard(): boolean {
        return !editor || editor.readOnly || JSON.stringify(editor.body) === original.current || window.confirm('Закрыть карточку без сохранения изменений?');
    }
    function closeEditor() { if (!writing.current && discard()) { setEditor(null); setError(''); } }
    function open(next: Editor): boolean {
        if (writing.current || !discard()) return false;
        original.current = JSON.stringify(next.body); setEditor(next); setError(''); return true;
    }
    function patch(patch: Partial<Draft>) { setEditor(current => current ? { ...current, body: { ...current.body, ...patch } } : null); }
    function newCategory() {
        open({ type: 'category', readOnly: false, body: { ...emptyDraft(), groupId: groupId || groups.data?.[0]?.id || '' } });
    }
    function selectCategory(c: ManagedCategory) {
        if (busy || writing.current) return;
        setSelectedId(c.id);
        if (c.id !== category?.id) setPointSearch('');
    }
    function showCategory(c: ManagedCategory) {
        if (open({ type: 'category', id: c.id, readOnly: !canManage || !c.active,
            body: { ...emptyDraft(), groupId: c.groupId, code: c.code, name: c.name, description: c.description ?? '', sortOrder: c.sortOrder } })) {
            selectCategory(c);
        }
    }
    function newPoint() {
        if (category?.active) open({ type: 'point', readOnly: false, body: { ...emptyDraft(), categoryId: category.id } });
    }
    function showPoint(p: ManagedPoint) {
        open({ type: 'point', id: p.id, readOnly: !canManage || !p.active || !category?.active,
            body: { ...emptyDraft(), categoryId: p.categoryId, code: p.code, name: p.name, description: p.description ?? '',
                commentTemplate: p.commentTemplate ?? '', defaultSeverity: p.defaultSeverity, sortOrder: p.sortOrder,
                requiresImage: p.requiresImage, requiresComment: p.requiresComment, requiresVideo: p.requiresVideo } });
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
        if (!editor || !editable || writing.current) return;
        const current = editor, body = current.body;
        const code = body.code.trim(), name = body.name.trim();
        if (!code || !name || !Number.isInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 2147483647) {
            setError('Укажите код, название и целый неотрицательный порядок сортировки.'); return;
        }
        let ok: boolean;
        if (current.type === 'category') {
            if (!body.groupId) { setError('Выберите тип события.'); return; }
            const payload: CategoryInput = { groupId: body.groupId, code, name, description: body.description, sortOrder: body.sortOrder };
            ok = await write(() => current.id ? catalogAdminApi.updateCategory(current.id, payload) : catalogAdminApi.createCategory(payload), 'Категория сохранена');
        } else {
            const payload: PointInput = { categoryId: body.categoryId, code, name, description: body.description, commentTemplate: body.commentTemplate,
                defaultSeverity: body.defaultSeverity, sortOrder: body.sortOrder, requiresImage: body.requiresImage, requiresComment: body.requiresComment, requiresVideo: body.requiresVideo };
            ok = await write(() => current.id ? catalogAdminApi.updatePoint(current.id, payload) : catalogAdminApi.createPoint(payload), 'Контрольная точка сохранена');
        }
        if (ok) setEditor(null);
    }
    async function remove(target: DeleteTarget) {
        setDeleting(null);
        const ok = await write(() => target.type === 'category' ? catalogAdminApi.deleteCategory(target.row.id) : catalogAdminApi.deletePoint(target.row.id), target.type === 'category' ? 'Категория и её контрольные точки удалены' : 'Контрольная точка удалена');
        if (ok) setEditor(null);
    }
    async function restore(target: DeleteTarget) {
        setRestoring(null);
        const ok = await write(() => target.type === 'category' ? catalogAdminApi.restoreCategory(target.row.id) : catalogAdminApi.restorePoint(target.row.id), target.type === 'category' ? 'Категория восстановлена. Контрольные точки восстанавливаются отдельно.' : 'Контрольная точка восстановлена');
        if (ok) setEditor(null);
    }
    const groupName = (id: string) => groups.data?.find(g => g.id === id)?.name ?? 'Тип не найден';
    const queryError = groups.error ?? categories.error ?? points.error;
    const editorCategoryName = editor ? categories.data?.find(c => c.id === editor.body.categoryId)?.name ?? editor.body.categoryId : '';
    const cardTitle = editor ? `${editor.id ? editable ? 'Редактирование' : 'Просмотр' : 'Создание'} ${editor.type === 'category' ? 'категории' : 'контрольной точки'}` : '';
    return <><Header /><div className="app-body"><Sidebar /><main className="workspace catalog-workspace">
        <div className="page-heading"><div><div className="breadcrumb-line">Ситуационный центр / Справочники</div><h1>Категории и контрольные точки</h1></div></div>
        {!canRead ? <section className="panel catalog-panel" role="alert">Нет права incident_catalog:read.</section> : <>
            <section className="panel catalog-toolbar">
                {!canManage && <span className="subtle">Только просмотр. Для изменений требуется incident_catalog:manage.</span>}
                <div className="catalog-filters">
                    <label>Тип события<select className="form-control" value={groupId} disabled={busy} onChange={e => { setGroupId(e.target.value); setSelectedId(''); }}><option value="">Все типы</option>{groups.data?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
                    <label className="catalog-check catalog-toggle-deleted"><input type="checkbox" checked={includeDeleted} disabled={busy} onChange={e => setIncludeDeleted(e.target.checked)} />Показать удалённые</label>
                </div>
            </section>
            {(error || queryError) && !editor && <section className="panel catalog-panel catalog-error" role="alert">{error || message(queryError)}{queryError && <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => { void groups.refetch(); void categories.refetch(); if (category) void points.refetch(); }}>Повторить загрузку</button>}</section>}
            <div className="catalog-columns">
                <section className="panel catalog-panel">
                    <div className="catalog-section-heading"><h2>Категории</h2>{canManage && <button type="button" className="btn btn-primary" disabled={busy || !loaded || !groups.data?.length} onClick={newCategory}>Добавить категорию</button>}</div>
                    <input className="form-control" type="search" aria-label="Поиск категории" placeholder="Название или код категории" value={categorySearch} disabled={busy} onChange={e => setCategorySearch(e.target.value)} />
                    {categories.isPending && <p role="status">Загрузка категорий…</p>}
                    {!categories.isPending && !categories.isError && !visible.length && <p className="subtle">Категорий по выбранным условиям нет.</p>}
                    <ul className="catalog-category-list">{visible.map(c => <li key={c.id}
                        className={`${c.id === category?.id ? 'is-selected' : ''} ${!c.active ? 'is-deleted' : ''}`}
                        tabIndex={busy ? -1 : 0} aria-current={c.id === category?.id ? 'true' : undefined}
                        aria-label={`Показать контрольные точки категории «${c.name}»`}
                        style={{ cursor: busy ? 'not-allowed' : 'pointer' }} onClick={() => selectCategory(c)}
                        onKeyDown={event => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCategory(c); }
                        }}>
                        <div className="catalog-category-select">
                            <button type="button" className="catalog-name-button" disabled={busy} aria-label={`Открыть категорию «${c.name}»`}
                                onClick={event => { event.stopPropagation(); showCategory(c); }}><span style={{ fontWeight: 600 }}>{c.name}</span></button>
                            <small className="subtle" style={{ display: 'block', marginTop: 5 }}>{groupName(c.groupId)} · {c.code}{!c.active ? ' · Удалена' : ''}</small>
                        </div>
                        {canManage && (c.active ? <TrashButton name={c.name} disabled={busy || !loaded} onClick={() => setDeleting({ type: 'category', row: c })} /> : <RestoreButton name={c.name} disabled={busy || !loaded} onClick={() => setRestoring({ type: 'category', row: c })} />)}
                    </li>)}</ul>
                </section>
                <section className="panel catalog-panel">
                    <div className="catalog-section-heading"><div><h2>Контрольные точки</h2><span className="subtle">{category?.name ?? 'Выберите категорию'}</span></div>{canManage && <button type="button" className="btn btn-primary" disabled={busy || !loaded || !category?.active} onClick={newPoint}>Добавить точку</button>}</div>
                    {category && <><input className="form-control" type="search" aria-label="Поиск контрольной точки" placeholder="Название или код контрольной точки" value={pointSearch} disabled={busy} onChange={e => setPointSearch(e.target.value)} />
                        {!category.active && <p className="subtle">Категория удалена. Для восстановления точек сначала восстановите категорию.</p>}
                        {points.isPending && <p role="status">Загрузка контрольных точек…</p>}
                        <div className="catalog-table-scroll" aria-busy={points.isFetching}><table className="catalog-table"><thead><tr><th>Название / код</th><th>Приоритет</th><th>Состояние</th>{canManage && <th className="catalog-delete-cell" aria-label="Удаление или восстановление" />}</tr></thead><tbody>
                            {visiblePoints.map(p => <tr key={p.id} className={!p.active ? 'is-deleted' : ''}><td><button type="button" className="catalog-name-button" disabled={busy || points.isFetching} aria-label={`Открыть контрольную точку «${p.name}»`} onClick={() => showPoint(p)}><span>{p.name}</span><small>{p.code}</small></button></td><td>{priorities[p.defaultSeverity] ?? p.defaultSeverity}</td><td>{p.active ? 'Активна' : 'Удалена'}</td>{canManage && <td className="catalog-delete-cell">{p.active ? category.active && <TrashButton name={p.name} disabled={busy || points.isFetching} onClick={() => setDeleting({ type: 'point', row: p })} /> : <RestoreButton name={p.name} disabled={busy || points.isFetching || !category.active} reason={!category.active ? 'Сначала восстановите категорию' : undefined} onClick={() => setRestoring({ type: 'point', row: p })} />}</td>}</tr>)}
                            {!points.isPending && !points.isError && !visiblePoints.length && <tr><td colSpan={canManage ? 4 : 3}>Контрольных точек по выбранным условиям нет.</td></tr>}
                        </tbody></table></div></>}
                </section>
            </div>
            <p className="subtle catalog-note">Строка категории показывает её точки, название открывает карточку. Удаление мягкое и каскадное для категории. Для восстановления включите «Показать удалённые» и нажмите иконку со стрелкой. Категория и точки восстанавливаются отдельно.</p>
        </>}
        {editor && <CatalogCard title={cardTitle} busy={busy} onClose={closeEditor} footer={<>
            {editable && <button className="btn btn-primary" type="submit" form="catalog-editor-form" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</button>}
            <button className="btn btn-outline-secondary" type="button" disabled={busy} onClick={closeEditor}>{editable ? 'Отмена' : 'Закрыть'}</button>
        </>}>
            <form id="catalog-editor-form" className="catalog-editor" onSubmit={event => void save(event)}>
                {error && <p className="catalog-error" role="alert">{error}</p>}
                {!editable && <p className="subtle">Просмотр записи. Изменение недоступно для удалённых записей или без права incident_catalog:manage.</p>}
                <fieldset disabled={busy || !editable}>
                    <div className="catalog-form-grid">
                        {editor.type === 'category' ? <label>Тип события<select required className="form-control" disabled={!!editor.id} value={editor.body.groupId} onChange={e => patch({ groupId: e.target.value })}><option value="">Выберите тип</option>{groups.data?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label> : <label>Категория<input className="form-control" readOnly value={editorCategoryName} /></label>}
                        <label>Код<input className="form-control" required maxLength={100} readOnly={!!editor.id} value={editor.body.code} onChange={e => patch({ code: e.target.value })} /></label>
                        <label>Название<input className="form-control" required maxLength={editor.type === 'category' ? 255 : 500} value={editor.body.name} onChange={e => patch({ name: e.target.value })} /></label>
                        <label>Порядок сортировки<input className="form-control" type="number" min={0} max={2147483647} step={1} required value={editor.body.sortOrder} onChange={e => patch({ sortOrder: Number(e.target.value) })} /></label>
                    </div>
                    <label>Описание<textarea className="form-control" rows={3} maxLength={10000} value={editor.body.description} onChange={e => patch({ description: e.target.value })} /></label>
                    {editor.type === 'point' && <>
                        <label>Шаблон комментария<textarea className="form-control" rows={3} maxLength={10000} value={editor.body.commentTemplate} onChange={e => patch({ commentTemplate: e.target.value })} /></label>
                        <label>Приоритет по умолчанию<select className="form-control" value={editor.body.defaultSeverity} onChange={e => patch({ defaultSeverity: e.target.value as IncidentSeverity })}>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <div className="catalog-requirements">{(['requiresImage', 'requiresComment', 'requiresVideo'] as const).map((key, index) => <label className="catalog-check" key={key}><input type="checkbox" checked={editor.body[key]} onChange={e => patch({ [key]: e.target.checked })} />{['Требуется изображение', 'Требуется комментарий', 'Требуется видео'][index]}</label>)}</div>
                    </>}
                    <p className="subtle">Код и принадлежность к типу/категории после создания не изменяются. Удалённые коды повторно не используются.</p>
                </fieldset>
            </form>
        </CatalogCard>}
        {deleting && <ActionDialog title={deleting.type === 'category' ? 'Удалить категорию и все её точки?' : 'Удалить контрольную точку?'} description={deleting.type === 'category' ? `Категория «${deleting.row.name}» и все её активные контрольные точки будут деактивированы одной операцией. Ранее зарегистрированные события сохранятся.` : `Контрольная точка «${deleting.row.name}» больше не будет доступна для новых привязок. Существующие связи сохранятся.`} confirmLabel="Удалить" onCancel={() => setDeleting(null)} onConfirm={() => { if (!writing.current) void remove(deleting); }} />}
        {restoring && <ActionDialog title={restoring.type === 'category' ? 'Восстановить категорию?' : 'Восстановить контрольную точку?'} description={restoring.type === 'category' ? `Категория «${restoring.row.name}» снова станет активной. Её удалённые контрольные точки автоматически не восстанавливаются — восстановите нужные отдельно.` : `Контрольная точка «${restoring.row.name}» снова станет доступна для выбора в активной категории. История и прежние связи сохранятся.`} confirmLabel="Восстановить" onCancel={() => setRestoring(null)} onConfirm={() => { if (!writing.current) void restore(restoring); }} />}
    </main></div></>;
}
