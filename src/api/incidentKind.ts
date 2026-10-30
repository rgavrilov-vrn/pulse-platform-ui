import type { IncidentKind, IncidentSummary } from './types';

export type ApiIncidentKind = 'EVENT' | 'VIOLATION';
export type ApiIncident<T extends IncidentSummary> = Omit<T, 'kind'> & {
    kind?: ApiIncidentKind | IncidentKind | null;
};

export function toApiKind(kind: IncidentKind | ApiIncidentKind): ApiIncidentKind {
    switch (kind) {
        case 'notice': case 'EVENT': return 'EVENT';
        case 'incident': case 'VIOLATION': return 'VIOLATION';
        default: throw new Error(`Unsupported incident kind: ${String(kind)}`);
    }
}

export function fromApiKind(kind: unknown): IncidentKind | null {
    switch (kind) {
        case 'EVENT': case 'notice': return 'notice';
        case 'VIOLATION': case 'incident': return 'incident';
        default: return null;
    }
}

function nonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
}

export function fromApiIncident<T extends IncidentSummary>(incident: ApiIncident<T>): T {
    const metadata = 'metadata' in incident ? incident.metadata : undefined;
    const metadataSiteName = metadata !== null && typeof metadata === 'object'
        && !Array.isArray(metadata) && 'siteName' in metadata ? metadata.siteName : undefined;
    return {
        ...incident,
        kind: fromApiKind(incident.kind),
        siteName: nonEmptyString(incident.siteName) ?? nonEmptyString(metadataSiteName),
    } as T;
}
