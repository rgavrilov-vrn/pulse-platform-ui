import { api } from './client';
import type {
    Category,
    CategoryGroup,
    ChecklistItem,
    Catalog,
    Facility,
} from './types';

export const catalogApi = {
    groups: () =>
        api.get<CategoryGroup[]>('/api/v1/incident/category-groups').then((r) => r.data),

    categories: () =>
        api.get<Category[]>('/api/v1/incident/categories').then((r) => r.data),

    checklistItems: () =>
        api.get<ChecklistItem[]>('/api/v1/incident/checklist-items').then((r) => r.data),

    facilities: () =>
        api.get<Facility[]>('/api/v1/ref/facilities', { params: { size: 200 } })
            .then((r) => (r.data as any).content ?? r.data),

    /** Один вызов, чтобы получить всё сразу (параллельно). */
    fetchAll: async (): Promise<Catalog> => {
        const [groups, categories, checklistItems, facilities] = await Promise.all([
            catalogApi.groups(),
            catalogApi.categories(),
            catalogApi.checklistItems(),
            catalogApi.facilities(),
        ]);
        return { groups, categories, checklistItems, facilities };
    },
};