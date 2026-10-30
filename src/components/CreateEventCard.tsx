import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { createManualIncident } from '../api/createIncident';
import type { Catalog, IncidentKind, IncidentSeverity, IncidentSummary } from '../api/types';
import './CreateEventCard.css';

interface Props {
    catalog: Catalog | undefined;
    onCreated: (incident: IncidentSummary) => void;
    onCancel: () => void;
}
export function CreateEventCard({ catalog, onCreated, onCancel }: Props) {
    const qc = useQueryClient();
    const [kind, setKind] = useState<IncidentKind>('notice');
    const [site, setSite] = useState('');
    const [time, setTime] = useState(() => formatInTimeZone(new Date(), 'Europe/Moscow', "yyyy-MM-dd'T'HH:mm:ss"));
    const [checkpoint, setCheckpoint] = useState('');
    const [comment, setComment] = useState('');
    const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
    const [groupId, setGroupId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');
    const groups = Array.isArray(catalog?.groups) ? catalog.groups : [];
    const categories = Array.isArray(catalog?.categories) ? catalog.categories : [];
    const facilities = Array.isArray(catalog?.facilities) ? catalog.facilities : [];
    const mutation = useMutation({ mutationFn: createManualIncident });
    const pending = mutation.isPending;
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (!dirty && !pending) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, pending]);
    function cancel() {
        if (!pending && (!dirty || window.confirm('Закрыть форму? Несохранённые данные будут потеряны.'))) onCancel();
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        if (!site.trim() || !comment.trim()) {
            setError('Укажите площадку и комментарий.'); return;
        }
        const eventTime = fromZonedTime(time, 'Europe/Moscow');
        if (Number.isNaN(eventTime.getTime())) { setError('Укажите корректное время события.'); return; }
        const group = groups.find((item) => item.id === groupId);
        const category = categories.find((item) => item.id === categoryId);
        setError('');
        try {
            const created = await mutation.mutateAsync({
                source: 'manual', creationMode: 'MANUAL', eventTime: eventTime.toISOString(),
                severity, comment: comment.trim(),
                metadata: {
                    kind, siteName: site.trim(), checkpoint: checkpoint.trim(),
                    directionId: group?.id, directionName: group?.name,
                    categoryId: category?.id, categoryName: category?.name,
                },
            });
            void qc.invalidateQueries({ queryKey: ['incidents'] });
            toast.success('Событие создано');
            onCreated(created);
        } catch (cause: unknown) {
            if (isAxiosError(cause) && cause.response?.status === 403) setError('Для создания требуется право incident:write.');
            else if (isAxiosError(cause) && typeof cause.response?.data?.message === 'string') setError(cause.response.data.message);
            else setError('Не удалось создать событие. Данные формы сохранены — повторите попытку.');
        }
    }
    return (
        <aside className="event-card panel create-event-card" aria-label="Создание события">
            <div className="card-heading">
                <div><div className="card-overline"><span>НОВОЕ СОБЫТИЕ</span><span className="status-badge draft">Черновик</span></div>
                    <h2>{categories.find((item) => item.id === categoryId)?.name ?? 'Создание события'}</h2></div>
                <button type="button" className="icon-btn" aria-label="Закрыть форму создания" disabled={pending} onClick={cancel}>×</button>
            </div>
            <form id="create-event-form" className="card-scroll" onSubmit={submit} onChange={() => setDirty(true)}>
                <div className="create-source-strip"><span>Ручная регистрация</span><span>{dirty ? 'Есть несохранённые изменения' : 'Заполните данные события'}</span></div>
                <fieldset disabled={pending}>
                    <div className="kind-field"><legend>Тип события</legend><div className="kind-switch">
                        <button type="button" className={kind === 'notice' ? 'active' : ''} aria-pressed={kind === 'notice'}
                            onClick={() => { setKind('notice'); setDirty(true); }}>ℹ Уведомление</button>
                        <button type="button" className={kind === 'incident' ? 'active' : ''} aria-pressed={kind === 'incident'}
                            onClick={() => { setKind('incident'); setDirty(true); }}>△ Инцидент</button>
                    </div></div>
                    <div className="field-block"><label htmlFor="create-site">Площадка</label>
                        <input id="create-site" className="form-control" list="create-sites" value={site} required autoFocus
                            onChange={(e) => setSite(e.target.value)} />
                        <datalist id="create-sites">{facilities.map((item) => <option key={item.id} value={item.name} />)}</datalist>
                    </div>
                    <div className="time-fields">
                        <div className="field-block"><label htmlFor="create-time">Время события (МСК)</label>
                            <input id="create-time" className="form-control" type="datetime-local" step="1" required value={time}
                                onChange={(e) => setTime(e.target.value)} /></div>
                        <div className="field-block"><label>Зарегистрировано</label><div className="readonly-value">Будет назначено сервером</div></div>
                    </div>
                    {groups.length > 0 && <div className="field-block"><span className="create-field-label">Направление</span>
                        <div className="create-choice-grid">{groups.map((item) => <button key={item.id} type="button"
                            className={groupId === item.id ? 'active' : ''} aria-pressed={groupId === item.id}
                            onClick={() => { setGroupId(item.id); setCategoryId(''); setDirty(true); }}>{item.name}</button>)}</div>
                    </div>}
                    {categories.length > 0 && <div className="field-block"><span className="create-field-label">Категория</span>
                        <div className="create-choice-grid">{categories.filter((item) => !groupId || item.groupId === groupId).map((item) => (
                            <button key={item.id} type="button" className={categoryId === item.id ? 'active' : ''} aria-pressed={categoryId === item.id}
                                onClick={() => { setCategoryId(item.id); setGroupId(item.groupId); setDirty(true); }}>{item.name}</button>
                        ))}</div>
                    </div>}
                    {!catalog && <p className="create-catalog-note">Справочники пока недоступны. Площадку можно ввести вручную; классификация необязательна.</p>}
                    <div className="field-block"><label htmlFor="create-severity">Критичность</label>
                        <select id="create-severity" className="form-control" value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
                            <option value="LOW">Низкая</option><option value="MEDIUM">Средняя</option>
                            <option value="HIGH">Высокая</option><option value="CRITICAL">Критическая</option>
                        </select></div>
                    <div className="field-block"><label htmlFor="create-checkpoint">Контрольная точка (при наличии)</label>
                        <input id="create-checkpoint" className="form-control" value={checkpoint} placeholder="Например, перегрузочная рампа"
                            onChange={(e) => setCheckpoint(e.target.value)} /></div>
                    <div className="field-block"><div className="create-label-row"><label htmlFor="create-comment">Комментарий</label><span>{comment.length} / 10000</span></div>
                        <textarea id="create-comment" className="form-control" rows={4} required maxLength={10000} value={comment}
                            placeholder="Опишите событие…" onChange={(e) => setComment(e.target.value)} /></div>
                </fieldset>
                {error && <p className="create-error" role="alert">{error}</p>}
            </form>
            <div className="card-actions"><div className="primary-actions">
                <button className="btn btn-primary" type="submit" form="create-event-form" disabled={pending}>{pending ? 'Создание…' : 'Создать событие'}</button>
                <button className="btn btn-outline-secondary" type="button" disabled={pending} onClick={cancel}>Отмена</button>
            </div></div>
        </aside>
    );
}
