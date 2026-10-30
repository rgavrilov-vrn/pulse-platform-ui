import type { IncidentStatus } from '../api/types';

const LABELS: Record<IncidentStatus, string> = {
    DRAFT: 'Черновик',
    RECORDED: 'Опубликовано',
    NEEDS_REVIEW: 'На проверке',
    CONFIRMED: 'Подтверждено',
    REJECTED: 'Отклонено',
    CLOSED: 'Закрыто',
    CANCELLED: 'Отменено',
    ARCHIVED: 'В архиве',
};

const CLASS: Record<IncidentStatus, string> = {
    DRAFT: 'draft',
    RECORDED: 'published',
    NEEDS_REVIEW: 'deferred',
    CONFIRMED: 'published',
    REJECTED: 'cancelled',
    CLOSED: 'published',
    CANCELLED: 'cancelled',
    ARCHIVED: 'cancelled',
};

export function StatusBadge({
                                status,
                                deferred,
                            }: {
    status: IncidentStatus;
    deferred?: boolean;
}) {
    const label = deferred ? 'Отложено' : LABELS[status];
    const cls = deferred ? 'deferred' : CLASS[status];
    return <span className={`status-badge ${cls}`}>{label}</span>;
}