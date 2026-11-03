import { api } from './client';
export interface ReportPoint { id: string | null; name: string; comment: string | null }
export interface ReportComment { source: string; occurredAt: string | null; author: string; text: string }
export interface ReportEntry {
    id: string; number: string; objectId: string | null; objectName: string;
    eventTime: string; createdAt: string; kind: string; category: string; status: string;
    createdBy: string; operatorName: string; cancellationReason: string | null;
    initialComment: string | null; resolutionComment: string | null;
    points: ReportPoint[]; comments: ReportComment[];
}
export interface ReportPage { content: ReportEntry[]; page: number; size: number; totalElements: number; totalPages: number }
export interface ReportOption { id: string; name: string; parentId: string | null }
export interface ReportOptions { objects: ReportOption[]; categories: ReportOption[]; checkpoints: ReportOption[]; operators: ReportOption[] }
const path = '/api/v1/reports/objects/incidents';
export const objectReportsApi = {
    list: (params: URLSearchParams, signal: AbortSignal) => api.get<ReportPage>(path, { params, signal }).then(r => r.data),
    options: (signal: AbortSignal) => api.get<ReportOptions>(`${path}/options`, { signal }).then(r => r.data),
    export: async (params: URLSearchParams, format: 'pdf' | 'xlsx') => {
        const selected = new URLSearchParams(params);
        selected.delete('page'); selected.delete('size'); selected.set('format', format);
        const response = await api.get<Blob>(`${path}/export`, { params: selected, responseType: 'blob', timeout: 180000 });
        const url = URL.createObjectURL(response.data);
        try {
            const link = document.createElement('a'); link.href = url; link.download = `object-report.${format}`;
            document.body.appendChild(link);
            try { link.click(); } finally { link.remove(); }
        } finally { window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
    },
};
