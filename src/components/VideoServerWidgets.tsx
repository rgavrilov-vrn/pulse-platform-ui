import { useEffect, useId, useRef, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import type { Page } from '../api/types';
import './VideoServerDialogs.css';

export const validUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const formatter = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'medium' });
export function videoTime(value: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}
export function videoError(error: unknown) {
    if (isAxiosError(error)) {
        if (error.response?.status === 403) return 'Недостаточно прав для этой операции.';
        if (error.response?.status === 404) return 'API не найден. Проверьте версию backend.';
        if (typeof error.response?.data?.message === 'string') return error.response.data.message;
    }
    return 'Не удалось выполнить запрос. Повторите попытку.';
}
export function VideoDialog({ title, busy = false, wide = false, onClose, children }: {
    title: string; busy?: boolean; wide?: boolean; onClose: () => void; children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const element = ref.current;
        if (element && !element.open) element.showModal();
        return () => { if (element?.open) element.close(); };
    }, []);
    return <dialog ref={ref} className={`vms-dialog${wide ? ' vms-dialog-wide' : ''}`} aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
        <div className="dialog-heading"><h2 id={titleId}>{title}</h2>
            <button className="icon-btn" type="button" disabled={busy} onClick={onClose} aria-label="Закрыть">×</button></div>
        {children}
    </dialog>;
}
export function VideoPager({ data, size, fetching, onPage, onSize }: {
    data?: Page<unknown>; size: number; fetching: boolean;
    onPage: (page: number) => void; onSize: (size: number) => void;
}) {
    const count = data?.content.length ?? 0;
    const first = count && data ? data.page * data.size + 1 : 0;
    const last = count ? first + count - 1 : 0;
    const busy = fetching || !data;
    return <footer className="vms-pagination">
        <span role="status" aria-live="polite">{fetching ? 'Обновление…' : data ? `Показано ${first}–${last} из ${data.totalElements}` : 'Данные недоступны'}</span>
        <label>Строк на странице<select className="form-control" value={size} disabled={fetching} onChange={(e) => onSize(Number(e.target.value))}>
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select></label>
        <nav aria-label="Пагинация">
            <button type="button" className="btn btn-outline-secondary" disabled={busy || !data?.hasPrevious} onClick={() => onPage(0)} aria-label="Первая страница">«</button>
            <button type="button" className="btn btn-outline-secondary" disabled={busy || !data?.hasPrevious} onClick={() => onPage(Math.max(0, (data?.page ?? 0) - 1))}>Назад</button>
            <span>{data ? `Страница ${data.totalPages ? data.page + 1 : 0} из ${data.totalPages}` : '—'}</span>
            <button type="button" className="btn btn-outline-secondary" disabled={busy || !data?.hasNext} onClick={() => onPage((data?.page ?? 0) + 1)}>Далее</button>
            <button type="button" className="btn btn-outline-secondary" disabled={busy || !data?.hasNext} onClick={() => onPage(Math.max(0, (data?.totalPages ?? 1) - 1))} aria-label="Последняя страница">»</button>
        </nav>
    </footer>;
}
