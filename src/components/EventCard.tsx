import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Catalog, IncidentSummary } from '../api/types';
import { incidentsApi, type UpdateBody } from '../api/incidents';
import { useAuthContext } from '../auth/AuthContext';
import { useCancelIncident, usePublishIncident, useIncident } from '../hooks/useIncidents';
import { StatusBadge } from './StatusBadge';
import { SeverityBadge } from './SeverityBadge';
import { EventForm, type EventFormValues, type CheckpointRemovalResult } from './EventForm';
import { savedCategoryNames } from './EventTypeSelector';
import { ActionDialog } from './ActionDialog';
import { IncidentMaterials } from './IncidentMaterials';
import './EventCardActions.css';

interface Props { incident: IncidentSummary; catalog: Catalog | undefined }
interface PendingCategoryChange { incidentId: string; body: UpdateBody; description: string }
export function EventCard({ incident, catalog }: Props) {
    const qc = useQueryClient();
    const { hasAuthority } = useAuthContext();
    const details = useIncident(incident.id);
    const publish = usePublishIncident();
    const cancel = useCancelIncident();
    const [dialog, setDialog] = useState<null | 'cancel'>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formRevision, setFormRevision] = useState(0);
    const [pending, setPending] = useState<PendingCategoryChange | null>(null);
    const [needsRefresh, setNeedsRefresh] = useState(false);
    const [preferredCheckpoint, setPreferredCheckpoint] = useState<{ incidentId: string; itemId: string } | null>(null);
    const writing = useRef(false);
    useEffect(() => { setPending(null); setDialog(null); setNeedsRefresh(false); setPreferredCheckpoint(null); }, [incident.id]);
    const confirmation = pending?.incidentId === incident.id ? pending : null;
    const operationBusy = saving || uploading || publish.isPending || cancel.isPending;
    const busy = operationBusy || !!confirmation || needsRefresh;
    const current = details.data ?? incident;
    const categoryNames = savedCategoryNames(current, catalog);
    const isDraft = current.status === 'DRAFT';
    const ready = !!details.data && !details.isError;
    const metadata = details.data?.metadata;
    const metadataCheckpoint = metadata?.checkpoint;
    const legacyCheckpoint = typeof details.data?.checkpoint === 'string' && details.data.checkpoint.trim() ? details.data.checkpoint
        : typeof metadataCheckpoint === 'string' ? metadataCheckpoint : '';
    const savedCheckpoints = (details.data?.checkpoints ?? []).map(link => {
        const item = catalog?.checklistItems.find(item => item.id === link.checklistItemId);
        return { id: link.id, itemId: link.checklistItemId, name: link.itemName || item?.name || link.checklistItemId, code: item?.code ?? `saved:${link.id}` };
    });
    const preferredItemId = preferredCheckpoint?.incidentId === incident.id ? preferredCheckpoint.itemId : undefined;
    const selectedCheckpoint = savedCheckpoints.find(point => point.itemId === preferredItemId) ?? savedCheckpoints[0];
    const checkpoint = selectedCheckpoint?.code ?? legacyCheckpoint;
    const checkpointLabel = selectedCheckpoint?.name
        ?? (typeof metadata?.checklistItemName === 'string' ? metadata.checklistItemName : undefined);
    const facilityId = typeof metadata?.objectId === 'string' && metadata.objectId ? metadata.objectId
        : typeof metadata?.facilityId === 'string' && metadata.facilityId ? metadata.facilityId : undefined;
    const initial = { kind: current.kind, categoryId: current.categoryId, siteName: current.siteName ?? '', facilityId,
        eventTime: current.eventTime, comment: current.comment ?? '', checkpoint, checkpointLabel, savedCheckpoints };
    async function removeSavedCheckpoint(linkId: string): Promise<CheckpointRemovalResult> {
        const unchanged = { removed: false, nextCheckpoint: checkpoint };
        if (writing.current || busy || !ready || !isDraft || !hasAuthority('incident:write')) return unchanged;
        const target = savedCheckpoints.find(point => point.id === linkId);
        if (!target || !window.confirm(`Снять привязку «${target.name}» к событию № ${current.number}? Точка в справочнике не удаляется. Снятие сохранится сразу; остальные несохранённые изменения останутся в форме.`)) return unchanged;
        const id = incident.id;
        let detached = false;
        writing.current = true; setSaving(true);
        try {
            await incidentsApi.removeCheckpoint(id, linkId); detached = true;
            await qc.cancelQueries({ queryKey: ['incident', id], exact: true });
            const updated = await incidentsApi.get(id);
            if (updated.categoryId !== current.categoryId || updated.categoryName !== current.categoryName || updated.kind !== current.kind)
                throw new Error('Категория карточки изменилась. Обновите данные перед продолжением.');
            const remaining = updated.checkpoints ?? [];
            const selected = remaining.find(link => link.checklistItemId === selectedCheckpoint?.itemId) ?? remaining[0];
            const nextCheckpoint = selected ? catalog?.checklistItems.find(item => item.id === selected.checklistItemId)?.code ?? `saved:${selected.id}` : '';
            setPreferredCheckpoint(selected ? { incidentId: id, itemId: selected.checklistItemId } : null);
            qc.setQueryData(['incident', id], updated);
            await Promise.all(['incidents', 'object-report', 'audit'].map(key => qc.invalidateQueries({ queryKey: [key] })));
            toast.success('Привязка снята');
            return { removed: true, nextCheckpoint };
        } catch (error) {
            if (detached || (isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0))) setNeedsRefresh(true);
            if (detached) toast.error('Привязка снята, но данные карточки не удалось обновить. Нажмите «Обновить карточку».');
            else if (isAxiosError(error)) toast.error(error.response?.data?.detail ?? error.response?.data?.message ?? 'Не удалось снять привязку');
            else toast.error('Не удалось снять привязку');
            return unchanged;
        } finally { writing.current = false; setSaving(false); }
    }
    async function perform(body: UpdateBody, id: string) {
        if (writing.current || operationBusy || id !== incident.id || !ready || !isDraft) return;
        writing.current = true; setSaving(true);
        try {
            const updated = await incidentsApi.update(id, body);
            const changingCategory = !!body.categoryId && body.categoryId !== current.categoryId;
            const desiredItemId = body.checkpoint ? catalog?.checklistItems.find(item => item.code === body.checkpoint)?.id
                : changingCategory ? undefined : selectedCheckpoint?.itemId;
            const retained = updated.checkpoints?.find(link => link.checklistItemId === desiredItemId);
            setPreferredCheckpoint(retained ? { incidentId: id, itemId: retained.checklistItemId } : null);
            await qc.cancelQueries({ queryKey: ['incident', id], exact: true });
            qc.setQueryData(['incident', id], updated);
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['incidents'] }),
                qc.invalidateQueries({ queryKey: ['incident', id], exact: true }),
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
            : legacyCheckpoint ? catalog?.checklistItems.find(p => p.code === legacyCheckpoint)?.name ?? legacyCheckpoint : '';
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
        setNeedsRefresh(false); setPending(null); setPreferredCheckpoint(null); setFormRevision(value => value + 1);
    }
    const registered = current.createdAt && !Number.isNaN(new Date(current.createdAt).getTime())
        ? formatInTimeZone(current.createdAt, 'Europe/Moscow', 'dd.MM.yyyy HH:mm:ss') : 'Не указано';
    return <aside className="event-card panel" aria-label="Карточка события">
        <div className="card-heading"><div style={{ minWidth: 0 }}>
            <div className="card-overline"><span>СОБЫТИЕ № {current.number}</span><StatusBadge status={current.status} /><SeverityBadge severity={current.severity} /></div>
            <h2>{categoryNames.join(' · ') || 'Без категории'}</h2>
            <div className="subtle" style={{ marginTop: 8, lineHeight: 1.5 }}>Зарегистрировано (МСК): {registered}</div>
        </div></div>
        {needsRefresh && <div role="alert" style={{ padding: 16 }}>Данные карточки или привязки изменились. Требуется обновить карточку перед продолжением.
            <button type="button" className="btn btn-outline-secondary" disabled={operationBusy || details.isFetching} onClick={() => void refreshAfterConflict()}>Обновить карточку</button></div>}
        {details.isError ? <div className="card-scroll"><p role="alert">Не удалось загрузить подробности события. Сохранение недоступно, чтобы не затереть данные.</p>
            <button type="button" className="btn btn-outline-secondary" disabled={details.isFetching} onClick={() => void details.refetch()}>Повторить</button></div>
            : !ready ? <div className="card-scroll" role="status">Загрузка карточки…</div>
            : <div className="card-scroll event-details-scroll">
                <EventForm key={`${incident.id}:${current.kind}:${current.categoryName}:${formRevision}`} initial={initial} severity={current.severity} categoryNames={categoryNames} catalog={catalog} disabled={!isDraft} onSave={onSave} saving={busy}
                    onRemoveCheckpoint={isDraft && hasAuthority('incident:write') ? removeSavedCheckpoint : undefined}
                    cancellationReason={current.status === 'CANCELLED' ? details.data?.cancellationReason ?? null : undefined} />
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
