import { api } from './client';
import type { IncidentSeverity } from './types';
export interface CategoryInput { groupId: string; code: string; name: string; description: string; sortOrder: number }
export interface ManagedCategory extends CategoryInput { id: string; active: boolean }
export interface PointInput {
    categoryId: string; code: string; name: string; description: string; commentTemplate: string;
    defaultSeverity: IncidentSeverity; sortOrder: number;
    requiresImage: boolean; requiresComment: boolean; requiresVideo: boolean;
}
export interface ManagedPoint extends PointInput { id: string; active: boolean }
const base = '/api/v1/incident/catalog-admin';
export const catalogAdminApi = {
    categories: (includeDeleted: boolean, signal?: AbortSignal) => api.get<ManagedCategory[]>(`${base}/categories`, { params: { includeDeleted }, signal }).then(r => r.data),
    points: (categoryId: string, includeDeleted: boolean, signal?: AbortSignal) => api.get<ManagedPoint[]>(`${base}/checklist-items`, { params: { categoryId, includeDeleted }, signal }).then(r => r.data),
    createCategory: (body: CategoryInput) => api.post<ManagedCategory>(`${base}/categories`, body).then(r => r.data),
    updateCategory: (id: string, body: CategoryInput) => api.put<ManagedCategory>(`${base}/categories/${id}`, body).then(r => r.data),
    deleteCategory: (id: string) => api.delete<{ deletedCheckpointCount: number }>(`${base}/categories/${id}`).then(r => r.data),
    restoreCategory: (id: string) => api.post<ManagedCategory>(`${base}/categories/${id}/restore`).then(r => r.data),
    createPoint: (body: PointInput) => api.post<ManagedPoint>(`${base}/checklist-items`, body).then(r => r.data),
    updatePoint: (id: string, body: PointInput) => api.put<ManagedPoint>(`${base}/checklist-items/${id}`, body).then(r => r.data),
    deletePoint: (id: string) => api.delete(`${base}/checklist-items/${id}`).then(() => undefined),
    restorePoint: (id: string) => api.post<ManagedPoint>(`${base}/checklist-items/${id}/restore`).then(r => r.data),
};
