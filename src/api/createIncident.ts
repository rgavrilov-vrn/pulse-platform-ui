import { api } from './client';
import { fromApiKind } from './incidentKind';
import type { IncidentSeverity, IncidentStatus, IncidentSummary } from './types';

export interface ManualIncidentBody {
    source: 'manual';
    creationMode: 'MANUAL';
    categoryId: string;
    eventTime: string;
    severity: IncidentSeverity;
    comment: string;
    metadata: {
        siteName: string;
        checkpoint: string;
        checklistItemId?: string;
        checklistItemName?: string;
        directionId?: string;
        directionName?: string;
        categoryName?: string;
    };
}
interface CreatedIncident {
    id: string;
    number: string;
    source: string;
    kind?: string | null;
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
        kind: fromApiKind(data.kind),
        siteName: body.metadata.siteName,
        categoryName: body.metadata.categoryName ?? null,
        directionName: body.metadata.directionName ?? null,
        deferredUntil: null,
        assignedToName: null,
        authorName: null,
    };
}
