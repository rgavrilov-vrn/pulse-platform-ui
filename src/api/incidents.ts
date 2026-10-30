import { api } from './client';
import type {
    IncidentDetails,
    IncidentKind,
    IncidentStatus,
    IncidentSummary,
    Page,
} from './types';

export interface ListParams {
    page?: number;
    size?: number;
    statuses?: IncidentStatus[];
    kind?: IncidentKind;
    search?: string;
    mineOnly?: boolean;
    deferred?: boolean;
    eventFrom?: string;
    eventTo?: string;
    sort?: string;
}

export interface CreateBody {
    kind: IncidentKind;
    source: string;
    eventTime: string;
    severity?: string;
    comment?: string;
    siteName?: string;
    categoryId?: string;
    directionCode?: string;
}

export interface UpdateBody {
    kind?: IncidentKind;
    eventTime?: string;
    comment?: string;
    checkpoint?: string;
}

export const incidentsApi = {
    list: (p: ListParams) =>
        api
            .get<Page<IncidentSummary>>('/api/v1/incidents', {
                params: {
                    page: p.page ?? 0,
                    size: p.size ?? 50,
                    sort: p.sort ?? 'eventTime,desc',
                    status: p.statuses?.join(','),
                    kind: p.kind,
                    search: p.search,
                    mineOnly: p.mineOnly,
                    deferred: p.deferred,
                    eventFrom: p.eventFrom,
                    eventTo: p.eventTo,
                },
            })
            .then((r) => r.data),

    get: (id: string) =>
        api.get<IncidentDetails>(`/api/v1/incidents/${id}`).then((r) => r.data),

    create: (body: CreateBody) =>
        api.post<IncidentDetails>('/api/v1/incidents', body).then((r) => r.data),

    update: (id: string, body: UpdateBody) =>
        api.patch<IncidentDetails>(`/api/v1/incidents/${id}`, body).then((r) => r.data),

    publish: (id: string) =>
        api.post<IncidentDetails>(`/api/v1/incidents/${id}/publish`).then((r) => r.data),

    defer: (id: string, body: { until: string; reason: string }) =>
        api
            .patch<IncidentDetails>(`/api/v1/incidents/${id}/defer`, body)
            .then((r) => r.data),

    changeStatus: (id: string, toStatus: IncidentStatus, comment?: string) =>
        api
            .patch<IncidentDetails>(`/api/v1/incidents/${id}/status`, { toStatus, comment })
            .then((r) => r.data),

    addComment: (id: string, commentType: string, body: string) =>
        api
            .post(`/api/v1/incidents/${id}/comments`, { commentType, body })
            .then((r) => r.data),

    uploadMaterial: (id: string, file: File) => {
        const form = new FormData();
        form.append('file', file);
        return api
            .post(`/api/v1/incidents/${id}/materials`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => r.data);
    },

    simulateIncoming: (count = 1) =>
        api
            .post<IncidentDetails[]>('/api/v1/dev/incoming', null, { params: { count } })
            .then((r) => r.data),

    resetDemo: () => api.post('/api/v1/dev/reset').then((r) => r.data),
};