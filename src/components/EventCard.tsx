import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Catalog, IncidentSummary } from '../api/types';
import { incidentsApi } from '../api/incidents';
import { useCancelIncident, useDeferIncident, usePublishIncident, useIncident } from '../hooks/useIncidents';
import { StatusBadge } from './StatusBadge';
import { EventForm, type EventFormValues } from './EventForm';
import { savedCategoryNames } from './EventTypeSelector';
import { ActionDialog } from './ActionDialog';

interface Props { incident: IncidentSummary; catalog: Catalog | undefined }
export function EventCard({ incident, catalog }: Props) {
    const qc = useQueryClient();
    const details = useIncident(incident.id);
    const publish = usePublishIncident();
    const defer = useDeferIncident();
    const cancel = useCancelIncident();
    const [dialog, setDialog] = useState<null | 'defer' | 'cancel'>(null);
    const [saving, setSaving] = useState(false);
    const current = details.data ?? incident;
    const categoryNames = savedCategoryNames(current, catalog);
    const isDraft = current.status === 'DRAFT';
    const ready = !!details.data && !details.isError;
    const metadataCheckpoint = details.data?.metadata?.checkpoint;
    const checkpoint = typeof details.data?.checkpoint === 'string' ? details.data.checkpoint
        : typeof metadataCheckpoint === 'string' ? metadataCheckpoint : '';
    const initial = { kind: current.kind, siteName: current.siteName ?? '', eventTime: current.eventTime, comment: current.comment ?? '', checkpoint };
    const onSave = async (values: EventFormValues) => {
        if (!ready) return;
        setSaving(true);
        try {
            await incidentsApi.update(incident.id, { kind: values.kind, eventTime: values.eventTime, comment: values.comment, checkpoint: values.checkpoint });
            void qc.invalidateQueries({ queryKey: ['incidents'] });
            void qc.invalidateQueries({ queryKey: ['incident', incident.id] });
            toast.success('Изменения сохранены');
        } catch (e: any) { toast.error(e.response?.data?.message ?? 'Ошибка сохранения'); }
        finally { setSaving(false); }
    };
    return <aside className="event-card panel" aria-label="Карточка события">
        <div className="card-heading"><div><div className="card-overline"><span>СОБЫТИЕ № {current.number}</span>
            <StatusBadge status={current.status} deferred={!!current.deferredUntil} /></div><h2>{categoryNames.join(' · ') || 'Без категории'}</h2></div></div>
        {details.isError ? <div className="card-scroll"><p role="alert">Не удалось загрузить подробности события. Сохранение недоступно, чтобы не затереть данные.</p>
            <button type="button" className="btn btn-outline-secondary" disabled={details.isFetching} onClick={() => void details.refetch()}>Повторить</button></div>
            : !ready ? <div className="card-scroll" role="status">Загрузка карточки…</div>
            : <EventForm key={incident.id} initial={initial} categoryNames={categoryNames} catalog={catalog} disabled={!isDraft} onSave={onSave} saving={saving} />}
        <div className="card-actions"><div className="primary-actions">
            <button className="btn btn-primary" disabled={!ready || !isDraft || !current.kind || saving || publish.isPending}
                title={!current.kind ? 'Сначала выберите тип события и сохраните изменения' : undefined} onClick={() => publish.mutate(incident.id)}>
                {current.status === 'RECORDED' ? 'Опубликовано' : 'Опубликовать'}</button>
            <button className="btn btn-outline-secondary" disabled={!ready || !isDraft || saving} type="submit" form="event-form">Сохранить</button>
            <button className="icon-btn postpone" disabled={!ready || !isDraft || saving} onClick={() => setDialog('defer')} title="Отложить на 30 минут">⏱</button>
        </div>{isDraft && <button className="cancel-button" disabled={!ready || saving} onClick={() => setDialog('cancel')}>Отменить регистрацию</button>}</div>
        {dialog === 'defer' && <ActionDialog title="Отложить на 30 минут?" description="Событие перейдёт в очередь «Отложено»." requireReason confirmLabel="Отложить"
            onConfirm={(reason) => { defer.mutate({ id: incident.id, reason }); setDialog(null); }} onCancel={() => setDialog(null)} />}
        {dialog === 'cancel' && <ActionDialog title="Отменить регистрацию?" description="Запись останется в реестре со статусом «Отменено»." requireReason confirmLabel="Отменить регистрацию"
            onConfirm={(reason) => { cancel.mutate({ id: incident.id, reason }); setDialog(null); }} onCancel={() => setDialog(null)} />}
    </aside>;
}
