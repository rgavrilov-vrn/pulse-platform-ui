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
        mutationFn: incidentsApi.publish,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['incidents'] });
            qc.invalidateQueries({ queryKey: ['incident'] });
            toast.success('Событие опубликовано');
        },
        onError: (e: any) =>
            toast.error(e.response?.data?.message ?? 'Не удалось опубликовать'),
    });
}

export function useDeferIncident() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            incidentsApi.defer(id, {
                until: new Date(Date.now() + 30 * 60_000).toISOString(),
                reason,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['incidents'] });
            toast.success('Отложено на 30 минут');
        },
    });
}

export function useCancelIncident() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            incidentsApi.changeStatus(id, 'CANCELLED', reason),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['incidents'] });
            toast.success('Регистрация отменена');
        },
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