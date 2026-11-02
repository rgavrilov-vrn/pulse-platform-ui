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

export function StatusBadge({ status }: { status: IncidentStatus }) {
    return <span className={`status-badge ${CLASS[status]}`}>{LABELS[status]}</span>;
}
