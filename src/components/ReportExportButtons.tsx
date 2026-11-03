import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import { objectReportsApi } from '../api/objectReports';

async function errorMessage(error: unknown): Promise<string> {
    if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 403) return 'Для выгрузки нужны права incident:read и incident:export.';
        if (status === 404) return 'API экспорта не найден. Обновите backend до версии с экспортом.';
        let data: unknown = error.response?.data;
        if (data instanceof Blob) {
            try { data = JSON.parse(await data.text()); } catch { data = null; }
        }
        if (data && typeof data === 'object') {
            const body = data as Record<string, unknown>;
            if (typeof body.detail === 'string') return body.detail;
            if (typeof body.message === 'string') return body.message;
        }
        if (status === 422) return 'Превышен лимит выгрузки. Сократите период или уточните фильтры. Данные не обрезаны.';
    }
    return 'Не удалось сформировать файл. Повторите запрос или сократите период.';
}
function DownloadIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></svg>;
}
export function ReportExportButtons({ params, disabled }: { params: URLSearchParams; disabled: boolean }) {
    const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
    const locked = useRef(false);
    async function download(format: 'pdf' | 'xlsx') {
        if (locked.current || disabled) return;
        locked.current = true; setExporting(format);
        const selected = new URLSearchParams(params);
        try { await objectReportsApi.export(selected, format); }
        catch (error) { toast.error(await errorMessage(error)); }
        finally { locked.current = false; setExporting(null); }
    }
    return <div className="report-actions" aria-label="Выгрузка всей выборки">
        <button type="button" className="btn btn-outline-secondary" disabled={disabled || !!exporting} aria-busy={exporting === 'pdf'} title="Выгрузить всю выборку по применённым фильтрам в PDF" onClick={() => void download('pdf')}><DownloadIcon />{exporting === 'pdf' ? 'Формирование PDF…' : 'PDF'}</button>
        <button type="button" className="btn btn-primary" disabled={disabled || !!exporting} aria-busy={exporting === 'xlsx'} title="Выгрузить всю выборку по применённым фильтрам в Excel" onClick={() => void download('xlsx')}><DownloadIcon />{exporting === 'xlsx' ? 'Формирование Excel…' : 'Excel'}</button>
    </div>;
}
