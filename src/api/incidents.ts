import { api } from './client';
import { fromApiIncident, toApiKind, type ApiIncident } from './incidentKind';
import type { IncidentDetails, IncidentKind, IncidentStatus, IncidentSummary, Page } from './types';

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
        api.get<Page<ApiIncident<IncidentSummary>>>('/api/v1/incidents', {
            params: {
                page: p.page ?? 0,
                size: p.size ?? 50,
                sort: p.sort ?? 'eventTime,desc',
                status: p.statuses?.join(','),
                kind: p.kind === undefined ? undefined : toApiKind(p.kind),
                search: p.search,
                mineOnly: p.mineOnly,
                deferred: p.deferred,
                eventFrom: p.eventFrom,
                eventTo: p.eventTo,
            },
        }).then((r): Page<IncidentSummary> => ({
            ...r.data,
            content: r.data.content.map((item) => fromApiIncident<IncidentSummary>(item)),
        })),

    get: (id: string) =>
        api.get<ApiIncident<IncidentDetails>>(`/api/v1/incidents/${id}`)
            .then((r) => fromApiIncident<IncidentDetails>(r.data)),

    create: (body: CreateBody) =>
        api.post<ApiIncident<IncidentDetails>>('/api/v1/incidents', { ...body, kind: toApiKind(body.kind) })
            .then((r) => fromApiIncident<IncidentDetails>(r.data)),

    update: (id: string, body: UpdateBody) =>
        api.patch<ApiIncident<IncidentDetails>>(`/api/v1/incidents/${id}`, {
            ...body,
            ...(body.kind === undefined ? {} : { kind: toApiKind(body.kind) }),
        }).then((r) => fromApiIncident<IncidentDetails>(r.data)),

    publish: (id: string) =>
        api.post<ApiIncident<IncidentDetails>>(`/api/v1/incidents/${id}/publish`)
            .then((r) => fromApiIncident<IncidentDetails>(r.data)),

    defer: (id: string, body: { until: string; reason: string }) =>
        api.patch<ApiIncident<IncidentDetails>>(`/api/v1/incidents/${id}/defer`, body)
            .then((r) => fromApiIncident<IncidentDetails>(r.data)),

    changeStatus: (id: string, toStatus: IncidentStatus, comment?: string) =>
        api.patch<ApiIncident<IncidentDetails>>(`/api/v1/incidents/${id}/status`, { toStatus, comment })
            .then((r) => fromApiIncident<IncidentDetails>(r.data)),

    addComment: (id: string, commentType: string, body: string) =>
        api.post(`/api/v1/incidents/${id}/comments`, { commentType, body }).then((r) => r.data),

    uploadMaterial: (id: string, file: File) => {
        const form = new FormData();
        form.append('file', file);
        return api.post(`/api/v1/incidents/${id}/materials`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then((r) => r.data);
    },

    simulateIncoming: (count = 1) =>
        api.post<ApiIncident<IncidentDetails>[]>('/api/v1/dev/incoming', null, { params: { count } })
            .then((r) => r.data.map((item) => fromApiIncident<IncidentDetails>(item))),

    resetDemo: () => api.post('/api/v1/dev/reset').then((r) => r.data),
};
