import { forwardRef, type SelectHTMLAttributes } from 'react';
import type { ChecklistItem } from '../api/types';

interface CheckpointSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    items: ChecklistItem[];
    selectedLabel?: string;
    emptyLabel?: string;
}

export const CheckpointSelect = forwardRef<HTMLSelectElement, CheckpointSelectProps>(
    function CheckpointSelect({ items, value, selectedLabel, emptyLabel = 'Не указана', ...props }, ref) {
        const selected = items.find((item) => item.code === value);
        const unknown = typeof value === 'string' && value !== '' && !selected;

        return <select {...props} ref={ref} value={value}>
            <option value="">{emptyLabel}</option>
            {unknown && <option value={value} disabled>{selectedLabel ? `${selectedLabel} (сохранена, недоступна для нового выбора)` : 'Недоступная контрольная точка — выберите заново'}</option>}
            {items.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
        </select>;
    },
);
