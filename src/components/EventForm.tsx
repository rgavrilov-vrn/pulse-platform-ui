import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Catalog, IncidentKind, IncidentSeverity } from '../api/types';
import { fromApiKind } from '../api/incidentKind';
import { CheckpointSelect } from './CheckpointSelect';
import { EventTypeSelector } from './EventTypeSelector';
import './CreateEventCard.css';
const severityOptions: { value: IncidentSeverity; label: string }[] = [
    { value: 'LOW', label: 'Низкая' }, { value: 'MEDIUM', label: 'Средняя' },
    { value: 'HIGH', label: 'Высокая' }, { value: 'CRITICAL', label: 'Критическая' },
];
const schema = z.object({ kind: z.enum(['notice', 'incident']), siteName: z.string(), eventTime: z.string().min(1, 'Укажите время'),
    comment: z.string().trim().min(1, 'Комментарий обязателен').max(10_000), checkpoint: z.string().optional() });
export type EventFormValues = z.infer<typeof schema>;
interface Props {
    initial: { kind: IncidentKind | null; siteName: string; eventTime: string; comment: string; checkpoint: string };
    severity: IncidentSeverity; categoryNames?: string[]; catalog: Catalog | undefined; disabled: boolean; saving: boolean; onSave: (values: EventFormValues) => void;
    cancellationReason?: string | null;
}
export function EventForm({ initial, severity, categoryNames = [], catalog, disabled, saving, onSave, cancellationReason }: Props) {
    const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
    const { register, handleSubmit, watch, setValue, getValues, getFieldState, setError, clearErrors, formState: { errors, isDirty } } = useForm<EventFormValues>({
        resolver: zodResolver(schema), defaultValues: { kind: initial.kind ?? undefined, siteName: initial.siteName,
            eventTime: formatInTimeZone(initial.eventTime, 'Europe/Moscow', "yyyy-MM-dd'T'HH:mm:ss"), comment: initial.comment, checkpoint: initial.checkpoint } });
    useEffect(() => {
        if (initial.kind && !getFieldState('kind').isDirty && getValues('kind') !== initial.kind) {
            setValue('kind', initial.kind, { shouldDirty: false, shouldValidate: true });
        }
        if (!getFieldState('checkpoint').isDirty && getValues('checkpoint') !== initial.checkpoint) {
            setValue('checkpoint', initial.checkpoint, { shouldDirty: false, shouldValidate: true });
        }
    }, [initial.kind, initial.checkpoint, getFieldState, getValues, setValue]);
    const kind = watch('kind');
    const checkpoint = watch('checkpoint') ?? '';
    const comment = watch('comment') ?? '';
    const groups = catalog?.groups ?? [];
    const categories = catalog?.categories ?? [];
    const items = catalog?.checklistItems ?? [];
    const facilities = catalog?.facilities ?? [];
    const group = groups.find((item) => fromApiKind(item.code) === kind);
    const availableCategories = group ? categories.filter((item) => item.groupId === group.id) : [];
    const initialItem = items.find((item) => item.code === initial.checkpoint);
    const savedCategory = availableCategories.find((item) => item.id === initialItem?.categoryId)
        ?? (categoryNames.length === 1 ? availableCategories.find((item) => item.name === categoryNames[0]) : undefined);
    const canUseDefault = kind !== initial.kind || (!initial.checkpoint && !categoryNames.length);
    const defaultName = kind === 'notice' ? 'Общая' : 'Биобезопасность';
    const defaultCategory = canUseDefault ? availableCategories.find((item) => item.name === defaultName) : undefined;
    const categoryId = categoryOverride ?? savedCategory?.id ?? defaultCategory?.id ?? '';
    const availableItems = categoryId ? items.filter((item) => item.categoryId === categoryId) : [];
    const locked = disabled || saving;
    return <form id="event-form" className="card-scroll" onSubmit={handleSubmit((values) => {
        if (locked) return;
        if (values.checkpoint && values.checkpoint !== initial.checkpoint && !availableItems.some((item) => item.code === values.checkpoint)) {
            setError('checkpoint', { type: 'validate', message: 'Выберите контрольную точку выбранной категории.' }); return;
        }
        const date = fromZonedTime(values.eventTime, 'Europe/Moscow');
        if (Number.isNaN(date.getTime())) { setError('eventTime', { type: 'validate', message: 'Укажите корректное время события.' }); return; }
        onSave({ ...values, eventTime: date.toISOString() });
    })}>
        <EventTypeSelector groups={groups} value={kind} disabled={locked} error={errors.kind ? 'Выберите тип события из справочника.' : undefined} onChange={(value) => {
            if (value !== kind) { setCategoryOverride(null); setValue('checkpoint', '', { shouldDirty: true }); clearErrors('checkpoint'); }
            setValue('kind', value, { shouldDirty: true, shouldValidate: true });
        }} />
        <fieldset disabled={locked}>
            <div className="field-block">
                <div className="create-choice-grid" role="group" aria-label="Критичность" aria-describedby="event-severity-note">
                    {severityOptions.map((option) => <button key={option.value} type="button" disabled className={(severity ?? 'MEDIUM') === option.value ? 'active' : ''}
                        aria-pressed={(severity ?? 'MEDIUM') === option.value}>{option.label}</button>)}
                </div>
                <small id="event-severity-note" className="subtle">Изменение критичности пока не поддерживается API.</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12 }}>
                <div className="field-block" style={{ minWidth: 0 }}><label htmlFor="event-site">Площадка</label>
                    <select id="event-site" className="form-control" style={{ width: '100%', minWidth: 0 }} value={initial.siteName} disabled aria-describedby="event-site-note">
                        <option value="">Не указана</option>
                        {initial.siteName && !facilities.some((item) => item.name === initial.siteName) && <option value={initial.siteName}>{initial.siteName}</option>}
                        {facilities.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select>
                    <small id="event-site-note" className="subtle">Изменение площадки пока не поддерживается API.</small>
                </div>
                <div className="field-block" style={{ minWidth: 0 }}><label htmlFor="event-time">Время события (МСК)</label>
                    <input id="event-time" type="datetime-local" step="1" className="form-control" style={{ width: '100%', minWidth: 0 }} {...register('eventTime')} />
                    {errors.eventTime && <small className="invalid-feedback d-block">{errors.eventTime.message}</small>}
                </div>
            </div>
            <div className="field-block">
                <div className="create-choice-grid" role="group" aria-label="Категория" aria-describedby="event-category-note">
                    {availableCategories.map((item) => <button key={item.id} type="button" className={categoryId === item.id ? 'active' : ''} aria-pressed={categoryId === item.id} onClick={() => {
                        if (categoryId !== item.id) { setCategoryOverride(item.id); setValue('checkpoint', '', { shouldDirty: true }); clearErrors('checkpoint'); }
                    }}>{item.name}</button>)}
                </div>
                {!availableCategories.length && <small className="subtle">Категории выбранного типа пока недоступны.</small>}
                <small id="event-category-note" className="subtle">Фильтр контрольных точек, а не изменение сохранённой категории. Сохранено: {categoryNames.join(' · ') || 'не указано'}.</small>
            </div>
            <div className="field-block"><label htmlFor="event-checkpoint">Контрольная точка (при наличии)</label>
                <CheckpointSelect id="event-checkpoint" className="form-control" items={availableItems} disabled={!categoryId}
                    {...register('checkpoint', { onChange: () => clearErrors('checkpoint') })} value={checkpoint} aria-invalid={!!errors.checkpoint} aria-describedby="event-checkpoint-note event-checkpoint-error" />
                <small id="event-checkpoint-note" className="subtle">{!categoryId ? 'Выберите категорию. ' : ''}Выбор добавляет привязку; существующие контрольные точки не удаляются.</small>
                {errors.checkpoint && <small id="event-checkpoint-error" className="invalid-feedback d-block" role="alert">{errors.checkpoint.message}</small>}
            </div>
            <div className="field-block comment-block"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <label htmlFor="event-comment" style={{ fontSize: 10, fontWeight: 600 }}>Комментарий</label><span className="subtle">{comment.length} / 10000</span>
            </div>
                <textarea id="event-comment" className="form-control" rows={4} maxLength={10000} placeholder="Опишите событие…" {...register('comment')} />
                {errors.comment && <small className="invalid-feedback d-block">{errors.comment.message}</small>}
            </div>
        </fieldset>
        {cancellationReason !== undefined && <div className="field-block">
            <label htmlFor="event-cancellation-reason">Причина отмены</label>
            <textarea id="event-cancellation-reason" className="form-control" rows={3} readOnly
                value={cancellationReason?.trim() ? cancellationReason : 'Причина отмены не указана'} />
        </div>}
        <button type="submit" hidden disabled={locked || !isDirty} />
    </form>;
}
