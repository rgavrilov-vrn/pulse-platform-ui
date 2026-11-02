import { useEffect, useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { materialsApi, type IncidentMaterial } from '../api/materials';
import { MaterialPreview } from './MaterialPreview';
import './IncidentMaterials.css';

type Job = { id: string; file: File; state: 'queued' | 'uploading' | 'done' | 'failed'; progress: number; error?: string };
interface Props { incidentId: string; canUpload: boolean; onUploadingChange: (value: boolean) => void }
function message(error: unknown): string {
    if (isAxiosError(error)) {
        if (error.response?.status === 413) return 'Файл превышает разрешённый размер.';
        if (error.response?.status === 415) return 'Этот формат файла не поддерживается.';
        if (error.response?.status === 403) return 'Недостаточно прав для работы с материалами.';
        if (error.response?.status === 409) return 'Изменять материалы можно только у черновика; файл должен находиться в локальном хранилище.';
        if (error.response?.status === 404) return 'Инцидент или файл не найден.';
        if (typeof error.response?.data?.message === 'string') return error.response.data.message;
        if (typeof error.response?.data?.detail === 'string') return error.response.data.detail;
    }
    return 'Операция не завершена. Проверьте список файлов перед повтором.';
}
function size(bytes: number): string {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
export function IncidentMaterials({ incidentId, canUpload, onUploadingChange }: Props) {
    const qc = useQueryClient();
    const contentId = useId();
    const [collapsed, setCollapsed] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const controller = useRef<AbortController | null>(null);
    const running = useRef(false);
    const dragDepth = useRef(0);
    const [dragging, setDragging] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [uploadBusy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const busy = uploadBusy || !!deleting;
    const [downloading, setDownloading] = useState<string | null>(null);
    const query = useQuery({
        queryKey: ['incident-materials', incidentId],
        queryFn: ({ signal }) => materialsApi.list(incidentId, signal),
        retry: false,
    });
    useEffect(() => () => {
        controller.current?.abort();
        onUploadingChange(false);
    }, [onUploadingChange]);
    function update(id: string, patch: Partial<Job>) {
        setJobs((current) => current.map((job) => job.id === id ? { ...job, ...patch } : job));
    }
    async function upload(batch: Job[]) {
        if (!canUpload || running.current) return;
        running.current = true;
        setBusy(true);
        onUploadingChange(true);
        const abort = new AbortController();
        controller.current = abort;
        try {
            for (const job of batch) {
                if (abort.signal.aborted) break;
                update(job.id, { state: 'uploading', progress: 0, error: undefined });
                try {
                    if (!job.file.size) throw new Error('Empty file');
                    const material = await materialsApi.upload(incidentId, job.file, abort.signal,
                        (progress) => update(job.id, { progress }));
                    update(job.id, { state: 'done', progress: 100 });
                    qc.setQueryData<IncidentMaterial[]>(['incident-materials', incidentId], (current) =>
                        [...(current ?? []).filter((item) => item.id !== material.id), material]);
                } catch (error) {
                    if (abort.signal.aborted) break;
                    update(job.id, { state: 'failed', error: job.file.size ? message(error) : 'Пустой файл нельзя прикрепить.' });
                }
            }
            if (!abort.signal.aborted) {
                await Promise.all([
                    qc.invalidateQueries({ queryKey: ['incident-materials', incidentId], exact: true }),
                    qc.invalidateQueries({ queryKey: ['incidents'] }),
                ]);
            }
        } finally {
            running.current = false;
            if (!abort.signal.aborted) { setBusy(false); onUploadingChange(false); }
        }
    }
    function addFiles(files: File[]) {
        if (!files.length || !canUpload || running.current) return;
        setCollapsed(false);
        const batch: Job[] = files.map((file) => ({ id: crypto.randomUUID(), file, state: 'queued', progress: 0 }));
        setJobs((current) => [...current, ...batch]);
        void upload(batch);
    }
    async function download(material: IncidentMaterial) {
        if (downloading || busy) return;
        setDownloading(material.id);
        try { await materialsApi.download(incidentId, material); }
        catch (error) { toast.error(message(error)); }
        finally { setDownloading(null); }
    }
    async function remove(material: IncidentMaterial): Promise<boolean> {
        if (!canUpload || running.current || downloading) return false;
        if (!window.confirm(`Удалить вложение «${material.fileName}»? Если файл больше нигде не используется, он будет удалён с диска. Это действие нельзя отменить.`)) return false;
        running.current = true;
        setDeleting(material.id);
        onUploadingChange(true);
        try {
            await api.delete(`/api/v1/incidents/${encodeURIComponent(incidentId)}/materials/${encodeURIComponent(material.id)}`);
            await qc.cancelQueries({ queryKey: ['incident-materials', incidentId], exact: true });
            qc.setQueryData<IncidentMaterial[]>(['incident-materials', incidentId], (current) =>
                (current ?? []).filter((item) => item.id !== material.id));
            setJobs((current) => current.filter((job) => job.state !== 'done'));
            toast.success('Вложение удалено');
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['incident-materials', incidentId], exact: true }),
                qc.invalidateQueries({ queryKey: ['incidents'] }),
            ]);
            return true;
        } catch (error) {
            toast.error(message(error));
            void qc.invalidateQueries({ queryKey: ['incident-materials', incidentId], exact: true });
            return false;
        } finally {
            running.current = false;
            setDeleting(null);
            onUploadingChange(false);
        }
    }
    return <section className="incident-materials" aria-label="Материалы события"
        onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
        onDrop={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault(); dragDepth.current = 0; setDragging(false);
            addFiles(Array.from(event.dataTransfer.files));
        }}>
        <div className="incident-materials-heading">
            <h3><button type="button" aria-expanded={!collapsed} aria-controls={contentId}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', color: 'inherit', font: 'inherit', padding: '6px 0' }}
                onClick={() => setCollapsed((value) => !value)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
                Материалы {query.data ? `(${query.data.length})` : ''}
            </button></h3>
            {canUpload && !collapsed && <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => input.current?.click()}>Прикрепить файлы</button>}
        </div>
        <div id={contentId} hidden={collapsed}>
        <input ref={input} type="file" hidden multiple disabled={!canUpload || busy}
            accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.mp4,.webm,.docx,.xlsx" onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = '';
            }} />
        {canUpload && <div className={`material-dropzone${dragging && !busy ? ' is-dragging' : ''}`}
            role="button" tabIndex={busy ? -1 : 0} aria-disabled={busy} aria-label="Перетащите файлы или выберите их на компьютере"
            onClick={() => { if (!busy) input.current?.click(); }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!busy) input.current?.click(); }
            }}
            onDragEnter={(event) => {
                if (!event.dataTransfer.types.includes('Files')) return;
                event.preventDefault(); dragDepth.current++; setDragging(true);
            }}
            onDragLeave={(event) => {
                event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (!dragDepth.current) setDragging(false);
            }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; }}>
            <span>{deleting ? 'Удаление вложения…' : busy ? 'Идёт загрузка файлов…' : dragging ? 'Отпустите файлы для загрузки' : 'Перетащите файлы сюда'}</span>
            <small>или нажмите, чтобы выбрать на компьютере</small>
        </div>}
        {canUpload && <p className="subtle">Фото, видео и документы. Файлы сохраняются сразу, отдельно от кнопки «Сохранить». Размер ограничивается настройками сервера.</p>}
        {query.isPending && <p role="status" className="subtle">Загрузка материалов…</p>}
        {query.isError && <div role="alert"><p>{message(query.error)}</p>
            <button type="button" className="btn btn-outline-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Повторить загрузку списка</button></div>}
        {query.isSuccess && !query.data.length && <p className="subtle">Прикреплённых файлов пока нет.</p>}
        {!!query.data?.length && <ul className="incident-material-list">{query.data.map((material) => <li key={material.id}>
            <div className="incident-material-name">
                <MaterialPreview incidentId={incidentId} material={material} canDelete={canUpload} busy={busy || !!downloading} deleting={deleting === material.id} onDelete={() => remove(material)} />
                <small>{size(material.sizeBytes)}</small>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button type="button" className="btn btn-outline-secondary" style={{ padding: 0, width: 34, height: 34 }}
                    disabled={!!downloading || busy} onClick={() => void download(material)} title={downloading === material.id ? 'Скачивание…' : 'Скачать'}
                    aria-label={`Скачать ${material.fileName}`} aria-busy={downloading === material.id}>
                    {downloading === material.id ? <span aria-hidden="true">…</span> : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></svg>}
                </button>
                {canUpload && <button type="button" className="btn btn-outline-secondary" style={{ padding: 0, width: 34, height: 34, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    disabled={busy || !!downloading} onClick={() => void remove(material)} title={deleting === material.id ? 'Удаление…' : 'Удалить'}
                    aria-label={`Удалить ${material.fileName}`} aria-busy={deleting === material.id}>
                    {deleting === material.id ? <span aria-hidden="true">…</span> : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg>}
                </button>}
            </div>
        </li>)}</ul>}
        {!!jobs.length && <ul className="incident-upload-list" aria-live="polite">{jobs.map((job) => <li key={job.id}>
            <span>{job.file.name}</span>
            {job.state === 'queued' && <small>В очереди</small>}
            {job.state === 'uploading' && <><progress value={job.progress} max={100} aria-label={`Загрузка ${job.file.name}`} />
                <small>{job.progress === 100 ? 'Сохранение на сервере…' : `${job.progress}%`}</small></>}
            {job.state === 'done' && <small>Прикреплён</small>}
            {job.state === 'failed' && <><p role="alert" className="incident-upload-error">{job.error}</p>
                {canUpload && <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => void upload([job])}>Повторить</button>}</>}
        </li>)}</ul>}
        </div>
    </section>;
}
