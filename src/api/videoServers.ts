import { api } from './client';
import type { Page } from './types';

export interface VideoServer {
    id: string;
    objectId: string | null;
    zoneId: string | null;
    source: string | null;
    externalId: string | null;
    name: string | null;
    host: string | null;
    baseUrl: string | null;
    description: string | null;
    status: string | null;
    isActive: boolean;
    createdAt: string | null;
    updatedAt: string | null;
}
export interface VideoServerParams {
    page: number;
    size: number;
    sort: string;
    search?: string;
    source?: string;
    objectId?: string;
    zoneId?: string;
    status?: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
    isActive?: boolean;
}
export async function listVideoServers(params: VideoServerParams, signal?: AbortSignal): Promise<Page<VideoServer>> {
    const { data } = await api.get<Page<VideoServer>>('/api/v1/videoserver/servers', {
        params: { ...params, sort: [params.sort, 'id,asc'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}
