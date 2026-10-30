import { api } from './client';
import type { IncidentSeverity, IncidentStatus, IncidentSummary } from './types';

export interface ManualIncidentBody {
    source: 'manual';
    creationMode: 'MANUAL';
    eventTime: string;
    severity: IncidentSeverity;
    comment: string;
    metadata: {
        kind: 'notice' | 'incident';
        siteName: string;
        checkpoint: string;
        categoryId?: string;
        categoryName?: string;
        directionId?: string;
        directionName?: string;
    };
}
interface CreatedIncident {
    id: string;
    number: string;
    source: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    eventTime: string;
    createdAt: string;
    updatedAt: string;
    comment: string | null;
}
export async function createManualIncident(body: ManualIncidentBody): Promise<IncidentSummary> {
    const { data } = await api.post<CreatedIncident>('/api/v1/incidents', body);
    return {
        ...data,
        kind: body.metadata.kind,
        siteName: body.metadata.siteName,
        categoryName: body.metadata.categoryName ?? null,
        directionName: body.metadata.directionName ?? null,
        deferredUntil: null,
        assignedToName: null,
        authorName: null,
    };
}
