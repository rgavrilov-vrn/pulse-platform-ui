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

function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : undefined;
}

export function fromApiIncident<T extends IncidentSummary>(incident: ApiIncident<T>): T {
    const metadata = record('metadata' in incident ? incident.metadata : undefined);
    return {
        ...incident,
        kind: fromApiKind(incident.kind) ?? fromApiKind(metadata?.kind),
        siteName: nonEmptyString(incident.siteName) ?? nonEmptyString(metadata?.siteName),
    } as T;
}
