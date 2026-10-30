import { api } from './client';
import { fromApiKind, toApiKind, type ApiIncidentKind } from './incidentKind';
import type { IncidentKind, IncidentSeverity, IncidentStatus, IncidentSummary } from './types';

export interface ManualIncidentBody {
    source: 'manual';
    creationMode: 'MANUAL';
    eventTime: string;
    severity: IncidentSeverity;
    comment: string;
    metadata: {
        kind: IncidentKind;
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
    kind?: ApiIncidentKind | IncidentKind;
    status: IncidentStatus;
    severity: IncidentSeverity;
    eventTime: string;
    createdAt: string;
    updatedAt: string;
    comment: string | null;
}
export async function createManualIncident(body: ManualIncidentBody): Promise<IncidentSummary> {
    const kind = toApiKind(body.metadata.kind);
    const { data } = await api.post<CreatedIncident>('/api/v1/incidents', {
        ...body,
        kind,
        metadata: { ...body.metadata, kind },
    });
    return {
        ...data,
        kind: fromApiKind(data.kind ?? kind),
        siteName: body.metadata.siteName,
        categoryName: body.metadata.categoryName ?? null,
        directionName: body.metadata.directionName ?? null,
        deferredUntil: null,
        assignedToName: null,
        authorName: null,
    };
}
