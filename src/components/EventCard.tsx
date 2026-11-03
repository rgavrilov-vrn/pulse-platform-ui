import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Catalog, IncidentSummary } from '../api/types';
import { incidentsApi, type UpdateBody } from '../api/incidents';
import { useCancelIncident, usePublishIncident, useIncident } from '../hooks/useIncidents';
import { StatusBadge } from './StatusBadge';
import { SeverityBadge } from './SeverityBadge';
import { EventForm, type EventFormValues } from './EventForm';
import { savedCategoryNames } from './EventTypeSelector';
import { ActionDialog } from './ActionDialog';
import { IncidentMaterials } from './IncidentMaterials';
import './EventCardActions.css';

interface Props { incident: IncidentSummary; catalog: Catalog | undefined }
interface PendingCategoryChange { incidentId: string; body: UpdateBody; description: string }
export function EventCard({ incident, catalog }: Props) {
    const qc = useQueryClient();
    const details = useIncident(incident.id);
    const publish = usePublishIncident();
    const cancel = useCancelIncident();
    const [dialog, setDialog] = useState<null | 'cancel'>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formRevision, setFormRevision] = useState(0);
    const [pending, setPending] = useState<PendingCategoryChange | null>(null);
    const [needsRefresh, setNeedsRefresh] = useState(false);
    const writing = useRef(false);
    useEffect(() => { setPending(null); setDialog(null); setNeedsRefresh(false); }, [incident.id]);
    const confirmation = pending?.incidentId === incident.id ? pending : null;
    const operationBusy = saving || uploading || publish.isPending || cancel.isPending;
    const busy = operationBusy || !!confirmation || needsRefresh;
    const current = details.data ?? incident;
    const categoryNames = savedCategoryNames(current, catalog);
    const isDraft = current.status === 'DRAFT';
    const ready = !!details.data && !details.isError;
    const metadataCheckpoint = details.data?.metadata?.checkpoint;
    const checkpoint = typeof details.data?.checkpoint === 'string' ? details.data.checkpoint : typeof metadataCheckpoint === 'string' ? metadataCheckpoint : '';
    const metadata = details.data?.metadata;
    const facilityId = typeof metadata?.objectId === 'string' && metadata.objectId ? metadata.objectId
        : typeof metadata?.facilityId === 'string' && metadata.facilityId ? metadata.facilityId : undefined;
    const initial = { kind: current.kind, siteName: current.siteName ?? '', facilityId, eventTime: current.eventTime, comment: current.comment ?? '', checkpoint };
    async function perform(body: UpdateBody, id: string) {
        if (writing.current || operationBusy || id !== incident.id || !ready || !isDraft) return;
        writing.current = true; setSaving(true);
        try {
            await incidentsApi.update(id, body);
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['incidents'] }),
                qc.invalidateQueries({ queryKey: ['incident', id] }),
                qc.invalidateQueries({ queryKey: ['object-report'] }),
                qc.invalidateQueries({ queryKey: ['audit'] }),
            ]);
            setFormRevision(value => value + 1);
            toast.success('Изменения сохранены');
        } catch (error) {
            if (isAxiosError(error)) {
                if (error.response?.status === 409) setNeedsRefresh(true);
                toast.error(error.response?.data?.detail ?? error.response?.data?.message ?? 'Ошибка сохранения');
            } else toast.error('Ошибка сохранения');
        } finally { writing.current = false; setSaving(false); }
    }
    const onSave = (values: EventFormValues) => {
        if (!ready || !isDraft || busy || writing.current) return;
        if (details.isFetching) { toast.error('Дождитесь обновления карточки и повторите сохранение.'); return; }
        const saved = details.data;
        if (!saved?.categoryId || !values.categoryId) { toast.error('Не удалось определить сохранённую категорию. Обновите карточку.'); return; }
        const changingCategory = values.categoryId !== saved.categoryId;
        const body: UpdateBody = { categoryId: values.categoryId, eventTime: values.eventTime, comment: values.comment, severity: values.severity,
            ...(values.facilityId ? { facilityId: values.facilityId } : values.clearFacility ? { clearFacility: true } : {}),
            ...(values.checkpoint && (changingCategory || values.checkpoint !== checkpoint) ? { checkpoint: values.checkpoint } : {}) };
        if (!changingCategory) { void perform(body, incident.id); return; }
        const target = catalog?.categories.find(c => c.id === values.categoryId);
        const nextPoint = values.checkpoint ? catalog?.checklistItems.find(p => p.code === values.checkpoint && p.categoryId === values.categoryId) : undefined;
        if (!target || (values.checkpoint && !nextPoint)) { toast.error('Обновите справочники и выберите категорию и точку заново.'); return; }
        if (!Number.isInteger(saved.version) || saved.version == null || !Array.isArray(saved.checkpoints)
            || saved.checkpoints.some(p => !p || typeof p.id !== 'string')) {
            toast.error('Backend не вернул версию карточки или список привязок. Безопасная смена категории недоступна.'); return;
        }
        const names = saved.checkpoints.map(p => p.itemName || p.checklistItemId);
        const legacyName = typeof metadata?.checklistItemName === 'string' ? metadata.checklistItemName
            : checkpoint ? catalog?.checklistItems.find(p => p.code === checkpoint)?.name ?? checkpoint : '';
        const oldName = saved.categoryName ?? catalog?.categories.find(c => c.id === saved.categoryId)?.name ?? saved.categoryId;
        const description = `Категория изменится с «${oldName}» на «${target.name}». `
            + (names.length ? `Будут мягко сняты прежние привязки (${names.length}): ${names.join('; ')}. ` : 'Активных привязок контрольных точек нет. ')
            + (legacyName ? `Прежняя отметка контрольной точки в данных карточки «${legacyName}» также будет очищена. ` : '')
            + (nextPoint ? `Будет добавлена точка «${nextPoint.name}». ` : 'Новая контрольная точка не выбрана. ')
            + 'Остальные изменения формы тоже сохранятся. Точки в справочнике не удаляются; история привязок и аудит сохраняются.';
        setPending({ incidentId: incident.id, description, body: { ...body, replaceCheckpoints: true,
            expectedCategoryId: saved.categoryId, expectedVersion: saved.version,
            expectedCheckpointIds: saved.checkpoints.map(p => p.id) } });
    };
    async function refreshAfterConflict() {
        if (!window.confirm('Обновить карточку и сбросить несохранённые изменения формы?')) return;
        const result = await details.refetch();
        if (result.isError) { toast.error('Не удалось обновить карточку.'); return; }
        setNeedsRefresh(false); setPending(null); setFormRevision(value => value + 1);
    }
    const registered = current.createdAt && !Number.isNaN(new Date(current.createdAt).getTime())
        ? formatInTimeZone(current.createdAt, 'Europe/Moscow', 'dd.MM.yyyy HH:mm:ss') : 'Не указано';
    return <aside className="event-card panel" aria-label="Карточка события">
        <div className="card-heading"><div style={{ minWidth: 0 }}>
            <div className="card-overline"><span>СОБЫТИЕ № {current.number}</span><StatusBadge status={current.status} /><SeverityBadge severity={current.severity} /></div>
            <h2>{categoryNames.join(' · ') || 'Без категории'}</h2>
            <div className="subtle" style={{ marginTop: 8, lineHeight: 1.5 }}>Зарегистрировано (МСК): {registered}</div>
        </div></div>
        {needsRefresh && <div role="alert" style={{ padding: 16 }}>Карточка или привязки изменились. Требуется обновить данные и подтвердить смену категории заново.
            <button type="button" className="btn btn-outline-secondary" disabled={operationBusy || details.isFetching} onClick={() => void refreshAfterConflict()}>Обновить карточку</button></div>}
        {details.isError ? <div className="card-scroll"><p role="alert">Не удалось загрузить подробности события. Сохранение недоступно, чтобы не затереть данные.</p>
            <button type="button" className="btn btn-outline-secondary" disabled={details.isFetching} onClick={() => void details.refetch()}>Повторить</button></div>
            : !ready ? <div className="card-scroll" role="status">Загрузка карточки…</div>
            : <div className="card-scroll event-details-scroll">
                <EventForm key={`${incident.id}:${current.kind}:${current.categoryName}:${formRevision}`} initial={initial} severity={current.severity} categoryNames={categoryNames} catalog={catalog} disabled={!isDraft} onSave={onSave} saving={busy} cancellationReason={current.status === 'CANCELLED' ? details.data?.cancellationReason ?? null : undefined} />
                <IncidentMaterials key={incident.id} incidentId={incident.id} canUpload={isDraft && !busy} onUploadingChange={setUploading} />
            </div>}
        {current.status !== 'CANCELLED' && <div className="card-actions event-card-actions"><div className="primary-actions">
            {isDraft && <button className="btn btn-primary" disabled={!ready || !current.kind || busy} title={!current.kind ? 'Сначала выберите тип события и сохраните изменения' : undefined} onClick={() => publish.mutate(incident.id)}>
                Опубликовать</button>}
            <button className="btn btn-outline-secondary" disabled={!ready || !isDraft || busy} type="submit" form="event-form">Сохранить</button>
        </div>
            {isDraft && <button type="button" className="cancel-button" disabled={!ready || busy} onClick={() => setDialog('cancel')}>Отменить регистрацию</button>}
        </div>}
        {isDraft && dialog === 'cancel' && <ActionDialog title="Отменить регистрацию?" description="Запись останется в реестре со статусом «Отменено»." requireReason confirmLabel="Отменить регистрацию" onConfirm={(reason) => { if (busy) return; cancel.mutate({ id: incident.id, reason }); setDialog(null); }} onCancel={() => setDialog(null)} />}
        {confirmation && <ActionDialog title="Сменить категорию и контрольные точки?" description={confirmation.description} confirmLabel="Сменить категорию и сохранить" onCancel={() => setPending(null)} onConfirm={() => {
            if (writing.current || operationBusy) return;
            const saved = details.data;
            const expectedIds = confirmation.body.expectedCheckpointIds ?? [];
            const actualIds = saved?.checkpoints?.map(p => p.id) ?? [];
            if (!saved || !isDraft || saved.categoryId !== confirmation.body.expectedCategoryId || saved.version !== confirmation.body.expectedVersion
                || actualIds.length !== expectedIds.length || actualIds.some(id => !expectedIds.includes(id))) {
                setPending(null); setNeedsRefresh(true); return;
            }
            setPending(null); void perform(confirmation.body, confirmation.incidentId);
        }} />}
    </aside>;
}
