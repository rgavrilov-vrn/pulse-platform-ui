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
export type VideoServerStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export interface VideoServerParams {
    page: number; size: number; sort: string;
    search?: string; source?: string; objectId?: string; zoneId?: string;
    status?: VideoServerStatus; isActive?: boolean;
}
export interface CreateVideoServerBody {
    objectId: string | null; zoneId: string | null;
    source: string; externalId: string; name: string;
    host: string | null; baseUrl: string | null; description: string | null;
    status: VideoServerStatus; isActive: boolean;
}
export interface VideoEvent {
    eventId: string; rawEventId: string | null; videoServerId: string;
    cameraId: string | null; channelId: string | null; objectId: string | null;
    occurredAt: string; source: string | null; eventType: string | null;
    severity: string | null; payloadVersion: number | null;
}
export interface VideoEventParams {
    videoServerId: string; page: number; size: number; sort: string;
    cameraId?: string; from?: string; to?: string;
}
export async function listVideoServers(params: VideoServerParams, signal?: AbortSignal): Promise<Page<VideoServer>> {
    const { data } = await api.get<Page<VideoServer>>('/api/v1/videoserver/servers', {
        params: { ...params, sort: [params.sort, 'id,asc'] }, paramsSerializer: { indexes: null }, signal,
    });
    return data;
}
export async function createVideoServer(body: CreateVideoServerBody): Promise<VideoServer> {
    const { data } = await api.post<VideoServer>('/api/v1/videoserver/servers', body);
    return data;
}
export async function listVideoEvents(params: VideoEventParams, signal?: AbortSignal): Promise<Page<VideoEvent>> {
    if (!params.videoServerId) throw new Error('videoServerId is required');
    const { data } = await api.get<Page<VideoEvent>>('/api/v1/videoserver/events', {
        params: { ...params, sort: [params.sort, 'id,desc'] }, paramsSerializer: { indexes: null }, signal,
    });
    return data;
}

export interface VideoCamera {
    id: string;
    videoServerId: string;
    source: string | null;
    externalId: string | null;
    code: string | null;
    name: string | null;
    description: string | null;
    status: string | null;
    isActive: boolean;
    lastSeenAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface VideoCameraParams {
    videoServerId: string;
    page: number;
    size: number;
    sort: string;
    q?: string;
    status?: string;
    isActive?: boolean;
    includeDeleted?: boolean;
}

export interface VideoChannel {
    id: string;
    videoServerId: string;
    cameraId: string | null;
    source: string | null;
    externalId: string | null;
    name: string | null;
    description: string | null;
    status: string | null;
    isActive: boolean;
    lastSeenAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface VideoChannelParams {
    videoServerId: string;
    page: number;
    size: number;
    sort: string;
    cameraId?: string;
    q?: string;
    status?: string;
    isActive?: boolean;
    includeInactive?: boolean;
}

export async function listVideoCameras(params: VideoCameraParams, signal?: AbortSignal): Promise<Page<VideoCamera>> {
    const { data } = await api.get<Page<VideoCamera>>('/api/v1/videoserver/cameras', {
        params: { ...params, sort: [params.sort, 'id,asc'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}

export async function listVideoChannels(params: VideoChannelParams, signal?: AbortSignal): Promise<Page<VideoChannel>> {
    const { data } = await api.get<Page<VideoChannel>>('/api/v1/videoserver/channels', {
        params: { ...params, sort: [params.sort, 'id,asc'] },
        paramsSerializer: { indexes: null },
        signal,
    });
    return data;
}