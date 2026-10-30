import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createVideoServer, type VideoServerStatus } from '../api/videoServers';
import { validUuid, VideoDialog, videoError } from './VideoServerWidgets';

const fields = [
    ['name', 'Название', 255, true], ['source', 'Источник (код)', 64, true],
    ['externalId', 'Внешний ID', 255, true], ['host', 'Host', 255, false],
    ['baseUrl', 'Base URL (http/https)', 512, false], ['objectId', 'ID объекта (UUID)', 36, false],
    ['zoneId', 'ID зоны (UUID)', 36, false],
] as const;
type TextFields = Record<typeof fields[number][0] | 'description', string>;
export function VideoServerCreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [form, setForm] = useState<TextFields>({ name: '', source: '', externalId: '', host: '', baseUrl: '', objectId: '', zoneId: '', description: '' });
    const [status, setStatus] = useState<VideoServerStatus>('UNKNOWN');
    const [active, setActive] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');
    const sending = useRef(false);
    const qc = useQueryClient();
    const mutation = useMutation({ mutationFn: createVideoServer, retry: false });
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (dirty || sending.current) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    function close() {
        if (!sending.current && (!dirty || window.confirm('Закрыть форму? Несохранённые данные будут потеряны.'))) onClose();
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (sending.current) return;
        if (!form.name.trim() || !form.source.trim() || !form.externalId.trim()) { setError('Заполните название, источник и внешний ID.'); return; }
        for (const key of ['objectId', 'zoneId'] as const) {
            if (form[key].trim() && !validUuid(form[key].trim())) { setError(`${key}: укажите корректный UUID.`); return; }
        }
        if (form.baseUrl.trim()) {
            try {
                if (!['http:', 'https:'].includes(new URL(form.baseUrl.trim()).protocol)) throw new Error();
            } catch { setError('Base URL должен быть абсолютным адресом http:// или https://.'); return; }
        }
        setError(''); sending.current = true;
        try {
            await mutation.mutateAsync({
                name: form.name.trim(), source: form.source.trim(), externalId: form.externalId.trim(),
                objectId: form.objectId.trim() || null, zoneId: form.zoneId.trim() || null,
                host: form.host.trim() || null, baseUrl: form.baseUrl.trim() || null,
                description: form.description.trim() || null, status, isActive: active,
            });
            void qc.invalidateQueries({ queryKey: ['video-servers'] });
            toast.success('Видеосервер создан');
            onCreated();
        } catch (cause: unknown) { setError(videoError(cause)); }
        finally { sending.current = false; }
    }
    return <VideoDialog title="Новый видеосервер" busy={mutation.isPending} onClose={close}>
        <form className="vms-create-form" onSubmit={submit} onChange={() => setDirty(true)}>
            <fieldset disabled={mutation.isPending}>
                <div className="vms-form-grid">{fields.map(([key, label, length, required]) => <label key={key}>{label}{required ? ' *' : ''}
                    <input className="form-control" value={form[key]} maxLength={length} required={required} autoFocus={key === 'name'}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </label>)}</div>
                <label>Описание<textarea className="form-control" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
                <div className="vms-form-grid"><label>Статус<select className="form-control" value={status} onChange={(e) => setStatus(e.target.value as VideoServerStatus)}>
                    <option value="UNKNOWN">Неизвестно (UNKNOWN)</option><option value="ONLINE">В сети (ONLINE)</option><option value="OFFLINE">Не в сети (OFFLINE)</option>
                </select></label><label className="vms-checkbox"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Активен</label></div>
            </fieldset>
            {error && <p className="vms-error" role="alert">{error}</p>}
            <div className="dialog-buttons"><button className="btn btn-outline-secondary" type="button" disabled={mutation.isPending} onClick={close}>Отмена</button>
                <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Создание…' : 'Создать'}</button></div>
        </form>
    </VideoDialog>;
}
