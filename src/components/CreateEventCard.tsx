import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { createManualIncident } from '../api/createIncident';
import { fromApiKind } from '../api/incidentKind';
import type { Catalog, ChecklistItem, IncidentKind, IncidentSeverity, IncidentSummary } from '../api/types';
import { CheckpointSelect } from './CheckpointSelect';
import { EventTypeSelector } from './EventTypeSelector';
import './CreateEventCard.css';

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
    const checklistItems = Array.isArray(catalog?.checklistItems) ? catalog.checklistItems : [];
    const facilities = Array.isArray(catalog?.facilities) ? catalog.facilities : [];
    const selectedGroup = groups.find((group) => fromApiKind(group.code) === kind);
    const availableCategories = selectedGroup ? categories.filter((item) => item.groupId === selectedGroup.id) : [];
    const availableChecklistItems: ChecklistItem[] = categoryId
        ? checklistItems.filter((item) => item.categoryId === categoryId)
        : [];
    const selectedChecklistItem = availableChecklistItems.find((item) => item.id === checklistItemId);
    const mutation = useMutation({ mutationFn: createManualIncident });
    const pending = mutation.isPending;
    useEffect(() => {
        if (categoryId || !selectedGroup) return;
        const defaultCategory = availableCategories.find((item) => item.name === 'Биобезопасность');
        if (defaultCategory) setCategoryId(defaultCategory.id);
    }, [availableCategories, categoryId, selectedGroup]);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => { if (dirty || pending) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, pending]);
    function cancel() { if (!pending && (!dirty || window.confirm('Закрыть форму? Несохранённые данные будут потеряны.'))) onCancel(); }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        if (!kind || !selectedGroup) { setError('Выберите тип события из справочника.'); return; }
        if (!site.trim() || !comment.trim()) { setError('Укажите площадку и комментарий.'); return; }
        if (!facilities.some((item) => item.name === site)) { setError('Выберите площадку из справочника.'); return; }
        const eventTime = fromZonedTime(time, 'Europe/Moscow');
        if (Number.isNaN(eventTime.getTime())) { setError('Укажите корректное время события.'); return; }
        const category = availableCategories.find((item) => item.id === categoryId);
        if (categoryId && !category) { setError('Категория не принадлежит выбранному типу. Выберите категорию заново.'); return; }
        if (checklistItemId && !selectedChecklistItem) { setError('Контрольная точка не принадлежит выбранной категории. Выберите её заново.'); return; }
        setError('');
        try {
            const created = await mutation.mutateAsync({
                source: 'manual', creationMode: 'MANUAL', eventTime: eventTime.toISOString(), severity, comment: comment.trim(),
                metadata: { kind, siteName: site.trim(), checkpoint: selectedChecklistItem?.code ?? '',
                    checklistItemId: selectedChecklistItem?.id, checklistItemName: selectedChecklistItem?.name,
                    directionId: selectedGroup.id, directionName: selectedGroup.name,
                    categoryId: category?.id, categoryName: category?.name },
            });
            void qc.invalidateQueries({ queryKey: ['incidents'] });
            toast.success('Событие создано'); onCreated(created);
        } catch (cause: unknown) {
            if (isAxiosError(cause) && cause.response?.status === 403) setError('Для создания требуется право incident:write.');
            else if (isAxiosError(cause) && typeof cause.response?.data?.message === 'string') setError(cause.response.data.message);
            else setError('Не удалось создать событие. Данные формы сохранены — повторите попытку.');
        }
    }
    return <aside className="event-card panel create-event-card" aria-label="Создание события">
        <div className="card-heading"><div><div className="card-overline"><span>НОВОЕ СОБЫТИЕ</span><span className="status-badge draft">Черновик</span></div>
            <h2>{availableCategories.find((item) => item.id === categoryId)?.name ?? 'Создание события'}</h2></div>
            <button type="button" className="icon-btn" aria-label="Закрыть форму создания" disabled={pending} onClick={cancel}>×</button></div>
        <form id="create-event-form" className="card-scroll" onSubmit={submit} onChange={() => setDirty(true)}>
            <div className="create-source-strip"><span>Ручная регистрация</span><span>{dirty ? 'Есть несохранённые изменения' : 'Заполните данные события'}</span></div>
            <EventTypeSelector groups={groups} value={kind} disabled={pending} onChange={(value) => {
                if (value !== kind) { setCategoryId(''); setChecklistItemId(''); }
                setKind(value); setDirty(true);
            }} />
            <fieldset disabled={pending}>
                <div className="field-block"><label htmlFor="create-severity">Критичность</label><select id="create-severity" className="form-control" value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
                    <option value="LOW">Низкая</option><option value="MEDIUM">Средняя</option><option value="HIGH">Высокая</option><option value="CRITICAL">Критическая</option></select></div>
                <div className="field-block"><label htmlFor="create-category">Категория</label>
                    <select id="create-category" className="form-control" value={categoryId} disabled={!selectedGroup}
                        onChange={(e) => { setCategoryId(e.target.value); setChecklistItemId(''); setDirty(true); }}>
                        <option value="">Не выбрана</option>
                        {availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    {!selectedGroup && <small className="create-catalog-note">Сначала выберите тип события.</small>}
                    {selectedGroup && !availableCategories.length && <small className="create-catalog-note">Для выбранного типа категории не загружены.</small>}
                </div>
                <div className="field-block"><label htmlFor="create-checkpoint">Контрольная точка (при наличии)</label>
                    <CheckpointSelect id="create-checkpoint" className="form-control" items={availableChecklistItems}
                        value={selectedChecklistItem?.code ?? ''} disabled={!categoryId}
                        onChange={(e) => {
                            const item = availableChecklistItems.find((candidate) => candidate.code === e.target.value);
                            setChecklistItemId(item?.id ?? ''); setDirty(true);
                        }} />
                    {!categoryId && <small className="create-catalog-note">Сначала выберите категорию.</small>}
                    {categoryId && !availableChecklistItems.length && <small className="create-catalog-note">Для выбранной категории контрольные точки не загружены.</small>}
                </div>
                <div className="field-block"><label htmlFor="create-site">Площадка</label>
                    <select id="create-site" className="form-control" value={site} required autoFocus disabled={!facilities.length} onChange={(e) => setSite(e.target.value)}>
                        <option value="">Не выбрана</option>
                        {facilities.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select>
                    {!facilities.length && <small className="create-catalog-note">Справочник площадок пока недоступен.</small>}
                </div>
                <div className="time-fields"><div className="field-block"><label htmlFor="create-time">Время события (МСК)</label>
                    <input id="create-time" className="form-control" type="datetime-local" step="1" required value={time} onChange={(e) => setTime(e.target.value)} /></div>
                    <div className="field-block"><label>Зарегистрировано</label><div className="readonly-value">Будет назначено сервером</div></div></div>
                <div className="field-block"><div className="create-label-row"><label htmlFor="create-comment">Комментарий</label><span>{comment.length} / 10000</span></div>
                    <textarea id="create-comment" className="form-control" rows={4} required maxLength={10000} value={comment} placeholder="Опишите событие…" onChange={(e) => setComment(e.target.value)} /></div>
            </fieldset>
            {error && <p className="create-error" role="alert">{error}</p>}
        </form>
        <div className="card-actions"><div className="primary-actions">
            <button className="btn btn-primary" type="submit" form="create-event-form" disabled={pending}>{pending ? 'Создание…' : 'Создать событие'}</button>
            <button className="btn btn-outline-secondary" type="button" disabled={pending} onClick={cancel}>Отмена</button>
        </div></div>
    </aside>;
}
