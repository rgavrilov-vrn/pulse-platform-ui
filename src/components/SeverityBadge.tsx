import type { IncidentSeverity } from '../api/types';
import './SeverityBadge.css';

const labels: Record<IncidentSeverity, string> = {
    LOW: 'Низкая',
    MEDIUM: 'Средняя',
    HIGH: 'Высокая',
    CRITICAL: 'Критическая',
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity | null | undefined }) {
    const label = severity ? labels[severity] : undefined;
    return <span className={`severity-badge severity-badge--${label ? severity!.toLowerCase() : 'unknown'}`}
        title={`Критичность события: ${label ?? 'не указана'}`}
        aria-label={`Критичность события: ${label ?? 'не указана'}`}>
        <span className="severity-badge__marker" aria-hidden="true">{severity === 'CRITICAL' ? '⚠' : '●'}</span>
        {label ?? 'Не указана'}
    </span>;
}
