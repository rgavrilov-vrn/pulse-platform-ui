import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Catalog, IncidentKind } from '../api/types';
import { fromDateTimeLocal, toDateTimeLocal } from '../utils/format';
import { CheckpointSelect, isCheckpoint } from './CheckpointSelect';

const schema = z.object({
    kind: z.enum(['notice', 'incident']),
    siteName: z.string().min(1, 'Укажите площадку'),
    eventTime: z.string().min(1, 'Укажите время'),
    comment: z.string().min(1, 'Комментарий обязателен').max(10_000),
    checkpoint: z.string().refine(isCheckpoint, 'Выберите контрольную точку из списка').optional(),
});
export type EventFormValues = z.infer<typeof schema>;
interface Props {
    initial: { kind: IncidentKind | null; siteName: string; eventTime: string; comment: string; checkpoint: string };
    catalog: Catalog | undefined;
    disabled: boolean;
    saving: boolean;
    onSave: (v: EventFormValues) => void;
}
export function EventForm({ initial, catalog, disabled, saving, onSave }: Props) {
    const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<EventFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            kind: initial.kind ?? undefined, siteName: initial.siteName,
            eventTime: toDateTimeLocal(initial.eventTime), comment: initial.comment, checkpoint: initial.checkpoint,
        },
    });
    const kind = watch('kind');
    const checkpoint = watch('checkpoint') ?? '';
    const facilities = Array.isArray(catalog?.facilities) ? catalog.facilities : [];
    return <form id="event-form" className="card-scroll" onSubmit={handleSubmit((v) => onSave({ ...v, eventTime: fromDateTimeLocal(v.eventTime) }))}>
        <fieldset className="kind-field" disabled={disabled || saving}>
            <legend>Тип события</legend><div className="kind-switch">
                <button type="button" className={kind === 'notice' ? 'active' : ''} aria-pressed={kind === 'notice'} onClick={() => setValue('kind', 'notice', { shouldDirty: true, shouldValidate: true })}>ℹ Уведомление</button>
                <button type="button" className={kind === 'incident' ? 'active' : ''} aria-pressed={kind === 'incident'} onClick={() => setValue('kind', 'incident', { shouldDirty: true, shouldValidate: true })}>▲ Инцидент</button>
            </div>
            {!kind && <small style={{ display: 'block', marginTop: 8, color: 'var(--muted)' }}>Тип не указан{disabled ? '.' : '. Выберите тип перед сохранением.'}</small>}
            {errors.kind && <small className="invalid-feedback d-block" role="alert">Выберите тип события.</small>}
        </fieldset>
        <div className="field-block"><label htmlFor="event-site">Площадка</label>
            <input id="event-site" className="form-control" list="sites" disabled={disabled || saving} {...register('siteName')} />
            <datalist id="sites">{facilities.map((f) => <option key={f.id} value={f.name} />)}</datalist>
            {errors.siteName && <small className="invalid-feedback d-block">{errors.siteName.message}</small>}
        </div>
        <div className="time-fields"><div className="field-block"><label htmlFor="event-time">Время события</label>
            <input id="event-time" type="datetime-local" className="form-control" disabled={disabled || saving} {...register('eventTime')} />
            {errors.eventTime && <small className="invalid-feedback d-block">{errors.eventTime.message}</small>}
        </div><div className="field-block"><label>Зарегистрировано</label><div className="readonly-value">{initial.eventTime}</div></div></div>
        <div className="field-block"><label htmlFor="event-checkpoint">Контрольная точка</label>
            <CheckpointSelect id="event-checkpoint" className="form-control" disabled={disabled || saving} {...register('checkpoint')}
                value={checkpoint} aria-invalid={!!errors.checkpoint} aria-describedby={errors.checkpoint ? 'event-checkpoint-error' : undefined} />
            {errors.checkpoint && <small id="event-checkpoint-error" className="invalid-feedback d-block" role="alert">{errors.checkpoint.message}</small>}
        </div>
        <div className="field-block comment-block"><label htmlFor="event-comment">Комментарий</label>
            <textarea id="event-comment" className="form-control" rows={4} disabled={disabled || saving} placeholder="Опишите, что наблюдается на видео…" {...register('comment')} />
            {errors.comment && <small className="invalid-feedback d-block">{errors.comment.message}</small>}
        </div>
        <button type="submit" hidden disabled={disabled || !isDirty || saving} />
    </form>;
}
