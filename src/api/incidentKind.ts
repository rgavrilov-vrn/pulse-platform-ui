import type { IncidentKind, IncidentSummary } from './types';

export type ApiIncidentKind = 'EVENT' | 'VIOLATION';
export type ApiIncident<T extends IncidentSummary> = Omit<T, 'kind'> & {
    kind: ApiIncidentKind | IncidentKind;
};

export function toApiKind(kind: IncidentKind | ApiIncidentKind): ApiIncidentKind {
    switch (kind) {
        case 'notice': case 'EVENT': return 'EVENT';
        case 'incident': case 'VIOLATION': return 'VIOLATION';
        default: throw new Error(`Unsupported incident kind: ${String(kind)}`);
    }
}

export function fromApiKind(kind: ApiIncidentKind | IncidentKind): IncidentKind {
    switch (kind) {
        case 'EVENT': case 'notice': return 'notice';
        case 'VIOLATION': case 'incident': return 'incident';
        default: throw new Error(`Unsupported incident kind in API response: ${String(kind)}`);
    }
}

export function fromApiIncident<T extends IncidentSummary>(incident: ApiIncident<T>): T {
    return { ...incident, kind: fromApiKind(incident.kind) } as T;
}
