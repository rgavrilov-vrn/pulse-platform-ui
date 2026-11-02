import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import { materialsApi, type IncidentMaterial } from '../api/materials';
import './IncidentMaterials.css';

type Job = { id: string; file: File; state: 'queued' | 'uploading' | 'done' | 'failed'; progress: number; error?: string };
interface Props { incidentId: string; canUpload: boolean; onUploadingChange: (value: boolean) => void }
function message(error: unknown): string {
    if (isAxiosError(error)) {
        if (error.response?.status === 413) return 'Файл превышает разрешённый размер.';
        if (error.response?.status === 415) return 'Этот формат файла не поддерживается.';
        if (error.response?.status === 403) return 'Недостаточно прав для работы с материалами.';
        if (error.response?.status === 409) return 'Прикладывать файлы можно только к черновику.';
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
    const input = useRef<HTMLInputElement>(null);
    const controller = useRef<AbortController | null>(null);
    const running = useRef(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [busy, setBusy] = useState(false);
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
    async function download(material: IncidentMaterial) {
        if (downloading) return;
        setDownloading(material.id);
        try { await materialsApi.download(incidentId, material); }
        catch (error) { toast.error(message(error)); }
        finally { setDownloading(null); }
    }
    return <section className="incident-materials" aria-label="Материалы события">
        <div className="incident-materials-heading">
            <h3>Материалы {query.data ? `(${query.data.length})` : ''}</h3>
            {canUpload && <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => input.current?.click()}>Прикрепить файлы</button>}
        </div>
        <input ref={input} type="file" hidden multiple disabled={!canUpload || busy}
            accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.mp4,.webm,.docx,.xlsx" onChange={(event) => {
                const batch: Job[] = Array.from(event.target.files ?? []).map((file) => ({
                    id: crypto.randomUUID(), file, state: 'queued', progress: 0,
                }));
                event.target.value = '';
                if (!batch.length || !canUpload || running.current) return;
                setJobs((current) => [...current, ...batch]);
                void upload(batch);
            }} />
        {canUpload && <p className="subtle">Фото, видео и документы. Файлы сохраняются сразу, отдельно от кнопки «Сохранить». Размер ограничивается настройками сервера.</p>}
        {query.isPending && <p role="status" className="subtle">Загрузка материалов…</p>}
        {query.isError && <div role="alert"><p>{message(query.error)}</p>
            <button type="button" className="btn btn-outline-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Повторить загрузку списка</button></div>}
        {query.isSuccess && !query.data.length && <p className="subtle">Прикреплённых файлов пока нет.</p>}
        {!!query.data?.length && <ul className="incident-material-list">{query.data.map((material) => <li key={material.id}>
            <div className="incident-material-name"><span>{material.fileName}</span><small>{size(material.sizeBytes)}</small></div>
            <button type="button" className="btn btn-outline-secondary" disabled={!!downloading} onClick={() => void download(material)}
                aria-label={`Скачать ${material.fileName}`}>{downloading === material.id ? 'Скачивание…' : 'Скачать'}</button>
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
    </section>;
}
