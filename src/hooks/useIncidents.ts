import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { incidentsApi, type ListParams } from '../api/incidents';

export function useIncidents(params: ListParams) {
    return useQuery({
        queryKey: ['incidents', params],
        queryFn: () => incidentsApi.list(params),
        placeholderData: (prev) => prev,
    });
}

export function useIncident(id: string | null) {
    return useQuery({
        queryKey: ['incident', id],
        queryFn: () => incidentsApi.get(id!),
        enabled: !!id,
    });
}

export function usePublishIncident() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => incidentsApi.changeStatus(id, 'RECORDED'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['incidents'] });
            qc.invalidateQueries({ queryKey: ['incident'] });
            toast.success('Событие опубликовано');
        },
        onError: (e: any) =>
            toast.error(e.response?.data?.message ?? 'Не удалось опубликовать'),
    });
}

export function useCancelIncident() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            incidentsApi.changeStatus(id, 'CANCELLED', reason),
        onSuccess: async (incident, { id }) => {
            await qc.cancelQueries({ queryKey: ['incident', id], exact: true });
            qc.setQueryData(['incident', id], incident);
            toast.success('Регистрация отменена');
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['incidents'] }),
                qc.invalidateQueries({ queryKey: ['incident', id], exact: true }),
            ]);
        },
        onError: (e: any) =>
            toast.error(e.response?.data?.message ?? 'Не удалось отменить регистрацию'),
    });
}

export function useCreateIncident() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: incidentsApi.create,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['incidents'] });
            toast.success('Событие создано');
        },
    });
}
