import { api } from './client';
import type { Page } from './types';

// --- Типы данных ---

export interface TrassirEventView {
    id: string;
    serverId: string | null;
    eventId: string | null;
    eventIndex: number | null;
    eventType: string | null;
    eventVersion: string | null;
    occurredAt: string | null;
    observedAt: string | null;
    status: string | null;
    retryCount: number;
    lastError: string | null;
    nextRetryAt: string | null;
    createdAt: string | null;
}

export interface TrassirSystemEventView {
    id: string;
    serverId: string | null;
    eventId: string | null;
    eventType: string | null;
    eventVersion: string | null;
    occurredAt: string | null;
    observedAt: string | null;
    severity: string | null;
    objectId: string | null;
    objectName: string | null;
    p1: string | null;
    p2: string | null;
    p3: string | null;
    data: string | null;
    source: string | null;
    createdAt: string | null;
}

export interface TrassirAdminAuditLogView {
    id: string;
    actor: string | null;
    action: string | null;
    target: string | null;
    details: Record<string, unknown> | null;
    correlationId: string | null;
    requestId: string | null;
    status: string | null;
    errorMessage: string | null;
    affectedCount: number | null;
    createdAt: string | null;
}

export interface TrassirIngestLogView {
    id: string;
    batchId: string | null;
    serverId: string | null;
    httpStatus: number | null;
    responseCode: string | null;
    durationMs: number | null;
    receivedAt: string | null;
    requestMethod?: string | null;
    requestUri?: string | null;
    requestBody?: string | null;
    responseBody?: string | null;
    errorMessage?: string | null;
}

// --- Параметры запросов ---

export interface TrassirEventParams {
    serverId?: string;
    eventType?: string;
    status?: string;
    from?: string;
    to?: string;
    page: number;
    size: number;
    sort?: string;
}

export interface TrassirSystemEventParams {
    serverId?: string;
    eventType?: string;
    severity?: string;
    objectId?: string;
    q?: string;
    from?: string;
    to?: string;
    page: number;
    size: number;
    sort?: string;
}

export interface TrassirAuditParams {
    actor?: string;
    action?: string;
    status?: string;
    from?: string;
    to?: string;
    page: number;
    size: number;
    sort?: string;
}

export interface TrassirIngestLogParams {
    serverId?: string;
    batchId?: string;
    httpStatus?: number;
    responseCode?: string;
    from?: string;
    to?: string;
    page: number;
    size: number;
    sort?: string;
}

// --- API Методы ---

export async function listTrassirEvents(params: TrassirEventParams, signal?: AbortSignal): Promise<Page<TrassirEventView>> {
    const { data } = await api.get<Page<TrassirEventView>>('/api/v1/trassir/events', {
        params: { ...params, sort: [params.sort || 'occurredAt,desc', 'id,desc'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}

export async function listTrassirSystemEvents(params: TrassirSystemEventParams, signal?: AbortSignal): Promise<Page<TrassirSystemEventView>> {
    const { data } = await api.get<Page<TrassirSystemEventView>>('/api/v1/trassir/system-events', {
        params: { ...params, sort: [params.sort || 'occurredAt,desc', 'id,desc'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}

export async function retryTrassirEvent(id: string): Promise<void> {
    await api.post(`/api/v1/trassir/admin/events/${id}/retry`);
}

export async function listTrassirAuditLog(params: TrassirAuditParams, signal?: AbortSignal): Promise<Page<TrassirAdminAuditLogView>> {
    const { data } = await api.get<Page<TrassirAdminAuditLogView>>('/api/v1/trassir/admin/audit', {
        params: { ...params, sort: [params.sort || 'createdAt,desc', 'id,desc'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}

export async function listTrassirIngestLogs(params: TrassirIngestLogParams, signal?: AbortSignal): Promise<Page<TrassirIngestLogView>> {
    const { data } = await api.get<Page<TrassirIngestLogView>>('/api/v1/trassir/admin/ingest-log', {
        params: { ...params, sort: [params.sort || 'receivedAt,desc', 'id,desc'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}