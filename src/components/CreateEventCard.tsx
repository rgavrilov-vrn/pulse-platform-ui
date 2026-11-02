import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { createManualIncident } from '../api/createIncident';
import { fromApiKind } from '../api/incidentKind';
import type { Catalog, IncidentKind, IncidentSeverity, IncidentSummary } from '../api/types';
import { CheckpointSelect } from './CheckpointSelect';
import { EventTypeSelector } from './EventTypeSelector';
import './CreateEventCard.css';
const severityOptions: { value: IncidentSeverity; label: string }[] = [
    { value: 'LOW', label: 'Низкая' }, { value: 'MEDIUM', label: 'Средняя' },
    { value: 'HIGH', label: 'Высокая' }, { value: 'CRITICAL', label: 'Критическая' },
];
interface Props { catalog: Catalog | undefined; onCreated: (incident: IncidentSummary) => void; onCancel: () => void }
export function CreateEventCard({ catalog, onCreated, onCancel }: Props) {
    const qc = useQueryClient();
    const [kind, setKind] = useState<IncidentKind>('incident');
    const [site, setSite] = useState('');
    const [time, setTime] = useState(() => formatInTimeZone(new Date(), 'Europe/Moscow', "yyyy-MM-dd'T'HH:mm:ss"));
    const [comment, setComment] = useState('');
    const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
    const [categoryId, setCategoryId] = useState('');
    const [checklistItemId, setChecklistItemId] = useState('');
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');
    const groups = Array.isArray(catalog?.groups) ? catalog.groups : [];
    const categories = Array.isArray(catalog?.categories) ? catalog.categories : [];
    const items = Array.isArray(catalog?.checklistItems) ? catalog.checklistItems : [];
    const facilities = Array.isArray(catalog?.facilities) ? catalog.facilities : [];
    const group = groups.find((item) => fromApiKind(item.code) === kind);
    const availableCategories = group ? categories.filter((item) => item.groupId === group.id) : [];
    const availableItems = categoryId ? items.filter((item) => item.categoryId === categoryId) : [];
    const selectedItem = availableItems.find((item) => item.id === checklistItemId);
    const mutation = useMutation({ mutationFn: createManualIncident });
    const pending = mutation.isPending;
    useEffect(() => {
        if (categoryId || !group) return;
        const defaultName = kind === 'notice' ? 'Общая' : 'Биобезопасность';
        const item = availableCategories.find((option) => option.name === defaultName);
        if (item) setCategoryId(item.id);
    }, [availableCategories, categoryId, group, kind]);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => { if (dirty || pending) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, pending]);
    function cancel() { if (!pending && (!dirty || window.confirm('Закрыть форму? Несохранённые данные будут потеряны.'))) onCancel(); }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        if (!kind || !group) { setError('Выберите тип события из справочника.'); return; }
        if (!site.trim() || !comment.trim()) { setError('Укажите площадку и комментарий.'); return; }
        if (!facilities.some((item) => item.name === site)) { setError('Выберите площадку из справочника.'); return; }
        const eventTime = fromZonedTime(time, 'Europe/Moscow');
        if (Number.isNaN(eventTime.getTime())) { setError('Укажите корректное время события.'); return; }
        const category = availableCategories.find((item) => item.id === categoryId);
        if (categoryId && !category) { setError('Категория не принадлежит выбранному типу. Выберите категорию заново.'); return; }
        if (checklistItemId && !selectedItem) { setError('Контрольная точка не принадлежит выбранной категории. Выберите её заново.'); return; }
        setError('');
        try {
            const created = await mutation.mutateAsync({ source: 'manual', creationMode: 'MANUAL', eventTime: eventTime.toISOString(), severity, comment: comment.trim(),
                metadata: { kind, siteName: site.trim(), checkpoint: selectedItem?.code ?? '', checklistItemId: selectedItem?.id, checklistItemName: selectedItem?.name,
                    directionId: group.id, directionName: group.name, categoryId: category?.id, categoryName: category?.name } });
            void qc.invalidateQueries({ queryKey: ['incidents'] });
            toast.success('Событие создано'); onCreated(created);
        } catch (cause: unknown) {
            if (isAxiosError(cause) && cause.response?.status === 403) setError('Для создания требуется право incident:write.');
            else if (isAxiosError(cause) && typeof cause.response?.data?.message === 'string') setError(cause.response.data.message);
            else setError('Не удалось создать событие. Данные формы сохранены — повторите попытку.');
        }
    }
    return <aside className="event-card panel create-event-card" aria-label="Создание события">
        <div className="card-heading"><div style={{ minWidth: 0 }}>
            <div className="card-overline"><span>НОВОЕ СОБЫТИЕ</span><span className="status-badge draft">Черновик</span></div>
            <h2>{availableCategories.find((item) => item.id === categoryId)?.name ?? 'Создание события'}</h2>
            <div className="subtle" style={{ marginTop: 8, lineHeight: 1.5 }}>Зарегистрировано (МСК): будет назначено сервером</div>
        </div><button type="button" className="icon-btn" aria-label="Закрыть форму создания" disabled={pending} onClick={cancel}>×</button></div>
        <form id="create-event-form" className="card-scroll" onSubmit={submit} onChange={() => setDirty(true)}>
            <div className="create-source-strip"><span>Ручная регистрация</span><span>{dirty ? 'Есть несохранённые изменения' : 'Заполните данные события'}</span></div>
            <EventTypeSelector groups={groups} value={kind} disabled={pending} onChange={(value) => {
                if (value !== kind) { setCategoryId(''); setChecklistItemId(''); } setKind(value); setDirty(true);
            }} />
            <fieldset disabled={pending}>
                <div className="field-block">
                    <div className="create-choice-grid" role="group" aria-label="Критичность">
                        {severityOptions.map((option) => <button key={option.value} type="button" className={severity === option.value ? 'active' : ''} aria-pressed={severity === option.value}
                            onClick={() => { setSeverity(option.value); setDirty(true); }}>{option.label}</button>)}
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12 }}>
                    <div className="field-block" style={{ minWidth: 0 }}><label htmlFor="create-site">Площадка</label>
                        <select id="create-site" className="form-control" style={{ width: '100%', minWidth: 0 }} value={site} required autoFocus disabled={!facilities.length} onChange={(event) => setSite(event.target.value)}>
                            <option value="">Не выбрана</option>{facilities.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                        </select>
                        {!facilities.length && <small className="create-catalog-note">Справочник площадок пока недоступен.</small>}
                    </div>
                    <div className="field-block" style={{ minWidth: 0 }}><label htmlFor="create-time">Время события (МСК)</label>
                        <input id="create-time" className="form-control" style={{ width: '100%', minWidth: 0 }} type="datetime-local" step="1" required value={time} onChange={(event) => setTime(event.target.value)} />
                    </div>
                </div>
                <div className="field-block">
                    <div className="create-choice-grid" role="group" aria-label="Категория">
                        {availableCategories.map((item) => <button key={item.id} type="button" className={categoryId === item.id ? 'active' : ''} aria-pressed={categoryId === item.id} onClick={() => {
                            if (categoryId !== item.id) { setCategoryId(item.id); setChecklistItemId(''); setDirty(true); }
                        }}>{item.name}</button>)}
                    </div>
                    {!group && <small className="create-catalog-note">Сначала выберите тип события.</small>}
                    {group && !availableCategories.length && <small className="create-catalog-note">Для выбранного типа категории не загружены.</small>}
                </div>
                <div className="field-block"><label htmlFor="create-checkpoint">Контрольная точка (при наличии)</label>
                    <CheckpointSelect id="create-checkpoint" className="form-control" items={availableItems} value={selectedItem?.code ?? ''} disabled={!categoryId} onChange={(event) => {
                        setChecklistItemId(availableItems.find((item) => item.code === event.target.value)?.id ?? ''); setDirty(true);
                    }} />
                    {!categoryId && <small className="create-catalog-note">Сначала выберите категорию.</small>}
                    {categoryId && !availableItems.length && <small className="create-catalog-note">Для выбранной категории контрольные точки не загружены.</small>}
                </div>
                <div className="field-block"><div className="create-label-row"><label htmlFor="create-comment">Комментарий</label><span>{comment.length} / 10000</span></div>
                    <textarea id="create-comment" className="form-control" rows={4} required maxLength={10000} value={comment} placeholder="Опишите событие…" onChange={(event) => setComment(event.target.value)} />
                </div>
            </fieldset>
            {error && <p className="create-error" role="alert">{error}</p>}
        </form>
        <div className="card-actions"><div className="primary-actions">
            <button className="btn btn-primary" type="submit" form="create-event-form" disabled={pending}>{pending ? 'Создание…' : 'Создать событие'}</button>
            <button className="btn btn-outline-secondary" type="button" disabled={pending} onClick={cancel}>Отмена</button>
        </div></div>
    </aside>;
}
