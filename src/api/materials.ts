import { api } from './client';

export interface IncidentMaterial {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    materialType: string;
    role: string;
    uploadedAt: string;
    downloadUrl: string;
}
const path = (id: string) => `/api/v1/incidents/${encodeURIComponent(id)}/materials`;
export const materialsApi = {
    list: (id: string, signal?: AbortSignal) =>
        api.get<IncidentMaterial[]>(path(id), { signal }).then((response) => response.data),
    upload: (id: string, file: File, signal: AbortSignal, progress: (value: number) => void) => {
        const body = new FormData();
        body.append('file', file);
        return api.post<IncidentMaterial>(path(id), body, {
            timeout: 120_000,
            signal,
            onUploadProgress: (event) => {
                if (event.total) progress(Math.min(100, Math.round(event.loaded / event.total * 100)));
            },
        }).then((response) => response.data);
    },
    download: async (id: string, material: IncidentMaterial) => {
        const response = await api.get<Blob>(`${path(id)}/${encodeURIComponent(material.id)}/download`, {
            responseType: 'blob', timeout: 120_000,
        });
        const url = URL.createObjectURL(response.data);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = material.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
};
