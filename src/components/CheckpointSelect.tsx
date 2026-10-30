import { forwardRef, type SelectHTMLAttributes } from 'react';

// Codes supplied from 009_seed_incident_catalog.sql; no unverified API endpoint.
export const CHECKPOINT_OPTIONS = [
    { code: 'TECHNICAL', name: 'Технические' },
    { code: 'INFRASTRUCTURE', name: 'Инфраструктурные' },
    { code: 'REGULATION_VIOLATIONS', name: 'Нарушения регламента' },
    { code: 'SANITARY_TREATMENTS', name: 'Санитарные обработки' },
    { code: 'TRANSPORT_WEIGHT_DISCREPANCY', name: 'Транспорт: расхождение по весу' },
    { code: 'TRANSPORT_OPERATIONS', name: 'Транспортные операции' },
] as const;
export function isCheckpoint(value: string): boolean {
    return value === '' || CHECKPOINT_OPTIONS.some((option) => option.code === value);
}
export const CheckpointSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
    function CheckpointSelect({ value, ...props }, ref) {
        const unknown = typeof value === 'string' && !isCheckpoint(value);
        return <select {...props} ref={ref} value={value}>
            <option value="">Не указана</option>
            {unknown && <option value={value} disabled>Неизвестный код: {value} — выберите из списка</option>}
            {CHECKPOINT_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
        </select>;
    },
);
