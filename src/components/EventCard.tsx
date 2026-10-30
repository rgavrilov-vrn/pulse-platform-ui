import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Catalog, IncidentSummary } from '../api/types';
import { incidentsApi } from '../api/incidents';
import { useCancelIncident, useDeferIncident, usePublishIncident } from '../hooks/useIncidents';
import { StatusBadge } from './StatusBadge';
import { EventForm, type EventFormValues } from './EventForm';
import { ActionDialog } from './ActionDialog';

interface Props {
    incident: IncidentSummary;
    catalog: Catalog | undefined;
}

export function EventCard({ incident, catalog }: Props) {
    const qc = useQueryClient();
    const publish = usePublishIncident();
    const defer = useDeferIncident();
    const cancel = useCancelIncident();
    const [dialog, setDialog] = useState<null | 'defer' | 'cancel'>(null);
    const [saving, setSaving] = useState(false);
    const isDraft = incident.status === 'DRAFT';
    const initial = useMemo(() => ({
        kind: incident.kind,
        siteName: incident.siteName ?? '',
        eventTime: incident.eventTime,
        comment: incident.comment ?? '',
        checkpoint: '',
    }), [incident.id, incident.kind]);

    const onSave = async (values: EventFormValues) => {
        setSaving(true);
        try {
            await incidentsApi.update(incident.id, {
                kind: values.kind,
                eventTime: values.eventTime,
                comment: values.comment,
                checkpoint: values.checkpoint,
            });
            qc.invalidateQueries({ queryKey: ['incidents'] });
            qc.invalidateQueries({ queryKey: ['incident', incident.id] });
            toast.success('Изменения сохранены');
        } catch (e: any) {
            toast.error(e.response?.data?.message ?? 'Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };
    return (
        <aside className="event-card panel" aria-label="Карточка события">
            <div className="card-heading"><div>
                <div className="card-overline"><span>СОБЫТИЕ № {incident.number}</span>
                    <StatusBadge status={incident.status} deferred={!!incident.deferredUntil} /></div>
                <h2>{incident.categoryName ?? 'Без категории'}</h2>
            </div></div>
            <EventForm key={incident.id} initial={initial} catalog={catalog}
                disabled={!isDraft} onSave={onSave} saving={saving} />
            <div className="card-actions">
                <div className="primary-actions">
                    <button className="btn btn-primary" disabled={!isDraft || !incident.kind || saving || publish.isPending}
                        title={!incident.kind ? 'Сначала выберите тип события и сохраните изменения' : undefined}
                        onClick={() => publish.mutate(incident.id)}>
                        {incident.status === 'RECORDED' ? 'Опубликовано' : 'Опубликовать'}
                    </button>
                    <button className="btn btn-outline-secondary" disabled={!isDraft || saving}
                        type="submit" form="event-form">Сохранить</button>
                    <button className="icon-btn postpone" disabled={!isDraft} onClick={() => setDialog('defer')}
                        title="Отложить на 30 минут">⏱</button>
                </div>
                {isDraft && <button className="cancel-button" onClick={() => setDialog('cancel')}>Отменить регистрацию</button>}
            </div>
            {dialog === 'defer' && <ActionDialog title="Отложить на 30 минут?"
                description="Событие перейдёт в очередь «Отложено»." requireReason confirmLabel="Отложить"
                onConfirm={(reason) => { defer.mutate({ id: incident.id, reason }); setDialog(null); }} onCancel={() => setDialog(null)} />}
            {dialog === 'cancel' && <ActionDialog title="Отменить регистрацию?"
                description="Запись останется в реестре со статусом «Отменено»." requireReason confirmLabel="Отменить регистрацию"
                onConfirm={(reason) => { cancel.mutate({ id: incident.id, reason }); setDialog(null); }} onCancel={() => setDialog(null)} />}
        </aside>
    );
}
