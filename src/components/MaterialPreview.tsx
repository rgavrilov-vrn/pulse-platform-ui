import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api/client';
import { materialsApi, type IncidentMaterial } from '../api/materials';
import toast from 'react-hot-toast';
import './MaterialPreview.css';

interface Props { incidentId: string; material: IncidentMaterial }
export function MaterialPreview({ incidentId, material }: Props) {
    const titleId = useId();
    const dialog = useRef<HTMLDialogElement>(null);
    const container = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [visible, setVisible] = useState(false);
    const [url, setUrl] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const image = ['image/jpeg', 'image/png', 'image/webp'].includes(material.mimeType);
    const video = ['video/mp4', 'video/webm'].includes(material.mimeType);
    const pdf = material.mimeType === 'application/pdf';
    const textual = ['text/plain', 'text/csv'].includes(material.mimeType);
    const supported = image || video || pdf || textual;
    const needContent = supported && (open || (image && visible && material.sizeBytes <= 5 * 1024 * 1024));
    useEffect(() => {
        if (!image || !container.current) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
        });
        observer.observe(container.current);
        return () => observer.disconnect();
    }, [image]);
    useEffect(() => {
        if (!needContent) return;
        const abort = new AbortController();
        let objectUrl: string | null = null;
        setLoading(true); setError(''); setUrl(null); setText('');
        void (async () => {
            try {
                const response = await api.get<Blob>(`/api/v1/incidents/${encodeURIComponent(incidentId)}/materials/${encodeURIComponent(material.id)}/download`,
                    { responseType: 'blob', timeout: 120_000, signal: abort.signal });
                if (abort.signal.aborted) return;
                const blob = new Blob([response.data], { type: material.mimeType });
                if (textual) {
                    const content = await blob.slice(0, 200_000).text();
                    if (!abort.signal.aborted) setText(content + (blob.size > 200_000 ? '\n… Показано начало файла. Скачайте файл целиком.' : ''));
                } else {
                    objectUrl = URL.createObjectURL(blob);
                    setUrl(objectUrl);
                }
            } catch {
                if (!abort.signal.aborted) setError('Не удалось загрузить предпросмотр. Попробуйте закрыть и открыть файл или скачать его.');
            } finally { if (!abort.signal.aborted) setLoading(false); }
        })();
        return () => { abort.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [needContent, incidentId, material.id, material.mimeType, textual]);
    useEffect(() => {
        const element = dialog.current;
        if (open && element && !element.open) element.showModal();
        if (!open && element?.open) element.close();
    }, [open]);
    async function download() {
        setDownloading(true);
        try { await materialsApi.download(incidentId, material); }
        catch { toast.error('Не удалось скачать файл.'); }
        finally { setDownloading(false); }
    }
    return <div ref={container} className="material-preview">
        {image && <button type="button" className="material-thumbnail" onClick={() => setOpen(true)} aria-label={`Просмотреть ${material.fileName}`}>
            {url && !error ? <img src={url} alt={material.fileName} loading="lazy" onError={() => setError('Не удалось прочитать изображение.')} />
                : <span>{loading ? 'Загрузка…' : error ? 'Открыть изображение' : 'Предпросмотр изображения'}</span>}
        </button>}
        <button type="button" className="material-file-link" onClick={() => setOpen(true)}>{material.fileName}</button>
        <dialog ref={dialog} className="material-preview-dialog" aria-labelledby={titleId}
            onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
            <div className="material-preview-heading"><h2 id={titleId}>{material.fileName}</h2>
                <button type="button" className="icon-btn" aria-label="Закрыть просмотр" onClick={() => setOpen(false)}>×</button></div>
            {open && <div className="material-preview-content">
                {loading && <p role="status">Загрузка файла…</p>}
                {error && <p role="alert">{error}</p>}
                {!supported && <p>Предпросмотр этого формата пока не поддерживается. Скачайте файл для просмотра на компьютере.</p>}
                {!loading && !error && image && url && <img className="material-full-image" src={url} alt={material.fileName} onError={() => setError('Не удалось прочитать изображение.')} />}
                {!loading && !error && video && url && <video controls preload="metadata" src={url} aria-label={material.fileName} onError={() => setError('Браузер не поддерживает формат или кодек видео. Скачайте файл.')} />}
                {!loading && !error && pdf && url && <><iframe src={url} title={material.fileName} sandbox="" /><p>Если браузер не показывает PDF, воспользуйтесь скачиванием.</p></>}
                {!loading && !error && textual && <pre>{text}</pre>}
            </div>}
            <div className="material-preview-actions">
                <button type="button" className="btn btn-outline-secondary" disabled={downloading} onClick={() => void download()}>{downloading ? 'Скачивание…' : 'Скачать'}</button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Закрыть</button>
            </div>
        </dialog>
    </div>;
}
