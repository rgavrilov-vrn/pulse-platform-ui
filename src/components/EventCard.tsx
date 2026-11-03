import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Catalog, IncidentSummary } from '../api/types';
import { incidentsApi } from '../api/incidents';
import { useCancelIncident, usePublishIncident, useIncident } from '../hooks/useIncidents';
import { StatusBadge } from './StatusBadge';
import { SeverityBadge } from './SeverityBadge';
import { EventForm, type EventFormValues } from './EventForm';
import { savedCategoryNames } from './EventTypeSelector';
import { ActionDialog } from './ActionDialog';
import { IncidentMaterials } from './IncidentMaterials';
import './EventCardActions.css';

interface Props { incident: IncidentSummary; catalog: Catalog | undefined }
export function EventCard({ incident, catalog }: Props) {
    const qc = useQueryClient();
    const details = useIncident(incident.id);
    const publish = usePublishIncident();
    const cancel = useCancelIncident();
    const [dialog, setDialog] = useState<null | 'cancel'>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const busy = saving || uploading || publish.isPending || cancel.isPending;
    const current = details.data ?? incident;
    const categoryNames = savedCategoryNames(current, catalog);
    const isDraft = current.status === 'DRAFT';
    const ready = !!details.data && !details.isError;
    const metadataCheckpoint = details.data?.metadata?.checkpoint;
    const checkpoint = typeof details.data?.checkpoint === 'string' ? details.data.checkpoint : typeof metadataCheckpoint === 'string' ? metadataCheckpoint : '';
    const initial = { kind: current.kind, siteName: current.siteName ?? '', eventTime: current.eventTime, comment: current.comment ?? '', checkpoint };
    const onSave = async (values: EventFormValues) => {
        if (!ready || !isDraft || busy) return;
        setSaving(true);
        try {
            await incidentsApi.update(incident.id, { categoryId: values.categoryId, eventTime: values.eventTime, comment: values.comment,
                ...(values.checkpoint && values.checkpoint !== checkpoint ? { checkpoint: values.checkpoint } : {}) });
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['incidents'] }),
                qc.invalidateQueries({ queryKey: ['incident', incident.id] }),
            ]);
            toast.success('Изменения сохранены');
        } catch (error: any) { toast.error(error.response?.data?.detail ?? error.response?.data?.message ?? 'Ошибка сохранения'); }
        finally { setSaving(false); }
    };
    const registered = current.createdAt && !Number.isNaN(new Date(current.createdAt).getTime())
        ? formatInTimeZone(current.createdAt, 'Europe/Moscow', 'dd.MM.yyyy HH:mm:ss') : 'Не указано';
    return <aside className="event-card panel" aria-label="Карточка события">
        <div className="card-heading"><div style={{ minWidth: 0 }}>
            <div className="card-overline"><span>СОБЫТИЕ № {current.number}</span><StatusBadge status={current.status} /><SeverityBadge severity={current.severity} /></div>
            <h2>{categoryNames.join(' · ') || 'Без категории'}</h2>
            <div className="subtle" style={{ marginTop: 8, lineHeight: 1.5 }}>Зарегистрировано (МСК): {registered}</div>
        </div></div>
        {details.isError ? <div className="card-scroll"><p role="alert">Не удалось загрузить подробности события. Сохранение недоступно, чтобы не затереть данные.</p>
            <button type="button" className="btn btn-outline-secondary" disabled={details.isFetching} onClick={() => void details.refetch()}>Повторить</button></div>
            : !ready ? <div className="card-scroll" role="status">Загрузка карточки…</div>
            : <div className="card-scroll event-details-scroll">
                <EventForm key={`${incident.id}:${current.kind}:${current.categoryName}`} initial={initial} severity={current.severity} categoryNames={categoryNames} catalog={catalog} disabled={!isDraft} onSave={onSave} saving={busy} cancellationReason={current.status === 'CANCELLED' ? details.data?.cancellationReason ?? null : undefined} />
                <IncidentMaterials key={incident.id} incidentId={incident.id} canUpload={isDraft && !saving && !publish.isPending && !cancel.isPending} onUploadingChange={setUploading} />
            </div>}
        {current.status !== 'CANCELLED' && <div className="card-actions event-card-actions"><div className="primary-actions">
            {isDraft && <button className="btn btn-primary" disabled={!ready || !current.kind || busy} title={!current.kind ? 'Сначала выберите тип события и сохраните изменения' : undefined} onClick={() => publish.mutate(incident.id)}>
                Опубликовать</button>}
            <button className="btn btn-outline-secondary" disabled={!ready || !isDraft || busy} type="submit" form="event-form">Сохранить</button>
        </div>
            {isDraft && <button type="button" className="cancel-button" disabled={!ready || busy} onClick={() => setDialog('cancel')}>Отменить регистрацию</button>}
        </div>}
        {isDraft && dialog === 'cancel' && <ActionDialog title="Отменить регистрацию?" description="Запись останется в реестре со статусом «Отменено»." requireReason confirmLabel="Отменить регистрацию" onConfirm={(reason) => { if (busy) return; cancel.mutate({ id: incident.id, reason }); setDialog(null); }} onCancel={() => setDialog(null)} />}
    </aside>;
}
