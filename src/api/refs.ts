import { api } from './client';
import type { Page } from './types';

export interface Zone {
    id: string;
    objectId: string | null;
    parentId: string | null;
    code: string | null;
    name: string;
    isActive: boolean;
}

export interface Facility {
    id: string;
    code: string | null;
    name: string;
    isActive: boolean;
}

export async function listZones(signal?: AbortSignal): Promise<Page<Zone>> {
    const { data } = await api.get<Page<Zone>>('/api/v1/ref/zones', {
        params: { size: 500, sort: ['name,ASC'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}

export async function listFacilities(signal?: AbortSignal): Promise<Page<Facility>> {
    const { data } = await api.get<Page<Facility>>('/api/v1/ref/facilities', {
        params: { size: 500, sort: ['name,ASC'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}