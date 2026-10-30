import { api } from './client';
import type { Page } from './types';

export interface AuditEntry {
    id: string;
    occurredAt: string;
    actorId: string | null;
    action: string;
    entitySchema: string;
    entityTable: string;
    entityId: string | null;
    requestId: string | null;
    sourceIp: string | null;
    userAgent: string | null;
}

export interface AuditParams {
    page: number;
    size: number;
    sort: string;
    q?: string;
    action?: string;
    entitySchema?: string;
    entityTable?: string;
    entityId?: string;
    actorId?: string;
    requestId?: string;
    from?: string;
    to?: string;
}

export async function listAudit(params: AuditParams, signal?: AbortSignal) {
    const sort = params.sort.startsWith('id,') ? [params.sort] : [params.sort, 'id,desc'];
    const response = await api.get<Page<AuditEntry>>('/api/v1/audit', {
        params: { ...params, sort },
        paramsSerializer: { indexes: null },
        signal,
    });
    return response.data;
}
