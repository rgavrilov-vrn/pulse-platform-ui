export type IncidentKind = 'notice' | 'incident';

export type IncidentStatus =
    | 'DRAFT'
    | 'RECORDED'
    | 'NEEDS_REVIEW'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'CLOSED'
    | 'CANCELLED'
    | 'ARCHIVED';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface UserInfo {
    id: string;
    login: string;
    displayName: string;
    roles: string[];
}

export interface IncidentSummary {
    id: string;
    number: string;
    source: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    kind: IncidentKind;
    eventTime: string;
    createdAt: string;
    updatedAt: string;
    deferredUntil: string | null;
    assignedToName: string | null;
    authorName: string | null;
    siteName: string | null;
    categoryName: string | null;
    directionName: string | null;
    comment: string | null;
}

export interface Material {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
}

export interface IncidentDetails extends IncidentSummary {
    checkpoint: string | null;
    cameraId: string | null;
    cameraName: string | null;
    deferReason: string | null;
    cancellationReason: string | null;
    metadata: Record<string, unknown>;
    materials: Material[];
}

export interface CategoryGroup {
    id: string;
    code: string;
    name: string;
    icon?: string;
    sortOrder: number;
}

export interface Category {
    id: string;
    groupId: string;
    code: string;
    name: string;
}

export interface ChecklistItem {
    id: string;
    categoryId: string;
    name: string;
    commentTemplate?: string;
}

export interface Facility {
    id: string;
    code: string;
    name: string;
}

export interface Zone {
    id: string;
    facilityId: string;
    name: string;
}

export interface Page<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export interface Catalog {
    groups: CategoryGroup[];
    categories: Category[];
    checklistItems: ChecklistItem[];
    facilities: Facility[];
}