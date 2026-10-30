import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Catalog } from '../api/types';
import { fromDateTimeLocal, toDateTimeLocal } from '../utils/format';

const schema = z.object({
    kind: z.enum(['notice', 'incident']),
    siteName: z.string().min(1, 'Укажите площадку'),
    eventTime: z.string().min(1, 'Укажите время'),
    comment: z.string().min(1, 'Комментарий обязателен').max(10_000),
    checkpoint: z.string().optional(),
});
type Values = z.infer<typeof schema>;

interface Props {
    initial: {
        kind: 'notice' | 'incident';
        siteName: string;
        eventTime: string;
        comment: string;
        checkpoint: string;
    };
    catalog: Catalog | undefined;
    disabled: boolean;
    saving: boolean;
    onSave: (v: Values & { eventTime: string }) => void;
}

export function EventForm({ initial, catalog, disabled, saving, onSave }: Props) {
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isDirty },
    } = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            kind: initial.kind,
            siteName: initial.siteName,
            eventTime: toDateTimeLocal(initial.eventTime),
            comment: initial.comment,
            checkpoint: initial.checkpoint,
        },
    });

    const kind = watch('kind');

    return (
        <form
            id="event-form"
            className="card-scroll"
            onSubmit={handleSubmit((v) =>
                onSave({ ...v, eventTime: fromDateTimeLocal(v.eventTime) }),
            )}
        >
            <fieldset className="kind-field" disabled={disabled}>
                <legend>Тип события</legend>
                <div className="kind-switch">
                    <button
                        type="button"
                        className={kind === 'notice' ? 'active' : ''}
                        onClick={() => setValue('kind', 'notice', { shouldDirty: true })}
                    >
                        ℹ Уведомление
                    </button>
                    <button
                        type="button"
                        className={kind === 'incident' ? 'active' : ''}
                        onClick={() => setValue('kind', 'incident', { shouldDirty: true })}
                    >
                        ▲ Инцидент
                    </button>
                </div>
            </fieldset>

            <div className="field-block">
                <label>Площадка</label>
                <input
                    className="form-control"
                    list="sites"
                    disabled={disabled}
                    {...register('siteName')}
                />
                <datalist id="sites">
                    {catalog?.facilities.map((f) => (
                        <option key={f.id} value={f.name} />
                    ))}
                </datalist>
                {errors.siteName && (
                    <small className="invalid-feedback d-block">{errors.siteName.message}</small>
                )}
            </div>

            <div className="time-fields">
                <div className="field-block">
                    <label>Время события</label>
                    <input
                        type="datetime-local"
                        className="form-control"
                        disabled={disabled}
                        {...register('eventTime')}
                    />
                    {errors.eventTime && (
                        <small className="invalid-feedback d-block">{errors.eventTime.message}</small>
                    )}
                </div>
                <div className="field-block">
                    <label>Зарегистрировано</label>
                    <div className="readonly-value">{initial.eventTime}</div>
                </div>
            </div>

            <div className="field-block">
                <label>Контрольная точка</label>
                <input
                    className="form-control"
                    disabled={disabled}
                    placeholder="Например, перегрузочная рампа"
                    {...register('checkpoint')}
                />
            </div>

            <div className="field-block comment-block">
                <label>Комментарий</label>
                <textarea
                    className="form-control"
                    rows={4}
                    disabled={disabled}
                    placeholder="Опишите, что наблюдается на видео…"
                    {...register('comment')}
                />
                {errors.comment && (
                    <small className="invalid-feedback d-block">{errors.comment.message}</small>
                )}
            </div>

            {/* Скрытый submit для кнопки "Сохранить" извне формы */}
            <button type="submit" hidden disabled={disabled || !isDirty || saving} />
        </form>
    );
}