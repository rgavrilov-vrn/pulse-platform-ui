import clsx from 'clsx';
import type { IncidentSummary } from '../api/types';
import { moscowTime, moscowDate, relative } from '../utils/format';
import { StatusBadge } from './StatusBadge';

export type Filter = 'all' | 'draft' | 'deferred' | 'published' | 'cancelled';

interface Props {
    rows: IncidentSummary[];
    loading: boolean;
    error: unknown;
    selectedId: string | null;
    filter: Filter;
    onFilterChange: (f: Filter) => void;
    search: string;
    onSearchChange: (s: string) => void;
    mineOnly: boolean;
    onMineOnlyChange: (v: boolean) => void;
    onSelect: (id: string) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'draft', label: 'Черновики' },
    { id: 'deferred', label: 'Отложено' },
    { id: 'published', label: 'Опубликовано' },
    { id: 'cancelled', label: 'Отменено' },
];

export function EventTable(p: Props) {
    return (
        <section className="registry panel" aria-labelledby="registryTitle">
            <div className="registry-heading">
                <div>
                    <h2 id="registryTitle">Реестр событий</h2>
                    <span className="subtle">Все площадки</span>
                </div>
            </div>

            <div className="queue-tabs" role="tablist">
                {FILTERS.map((f) => (
                    <button
                        key={f.id}
                        className={clsx('queue-tab', { active: p.filter === f.id })}
                        role="tab"
                        aria-selected={p.filter === f.id}
                        onClick={() => p.onFilterChange(f.id)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="registry-tools">
                <label className="search-field">
                    <input
                        type="search"
                        placeholder="Площадка, событие или автор"
                        value={p.search}
                        onChange={(e) => p.onSearchChange(e.target.value)}
                    />
                </label>
                <label className="mine-toggle">
                    <input
                        type="checkbox"
                        checked={p.mineOnly}
                        onChange={(e) => p.onMineOnlyChange(e.target.checked)}
                    />
                    <span>Только мои</span>
                </label>
            </div>

            <div className="table-scroll">
                <table className="table event-table">
                    <thead>
                    <tr>
                        <th>Время события <span>Регистрация</span></th>
                        <th>Событие <span>Площадка и описание</span></th>
                        <th>Состояние <span>Автор</span></th>
                    </tr>
                    </thead>
                    <tbody>
                    {p.loading && p.rows.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>Загрузка…</td></tr>
                    )}
                    {!p.loading && p.rows.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>
                            {p.error ? 'Не удалось загрузить события' : 'Событий нет'}
                        </td></tr>
                    )}
                    {p.rows.map((e) => (
                        <tr
                            key={e.id}
                            tabIndex={0}
                            className={clsx({ selected: e.id === p.selectedId })}
                            onClick={() => p.onSelect(e.id)}
                            onKeyDown={(ev) => {
                                if (ev.key === 'Enter' || ev.key === ' ') {
                                    ev.preventDefault();
                                    p.onSelect(e.id);
                                }
                            }}
                        >
                            <td>
                                <div className="event-time">
                                    {moscowTime(e.eventTime)}
                                    <small className="date-label">{moscowDate(e.eventTime)}</small>
                                </div>
                                <div className="registration-time">{relative(e.createdAt)}</div>
                            </td>
                            <td>
                                <div className="event-title">
                                    <span className={clsx('type-dot', e.kind)} />
                                    {e.categoryName ?? 'Без категории'}
                                </div>
                                <div className="event-site">{e.siteName ?? '—'}</div>
                                <div className="event-summary">{e.comment ?? ''}</div>
                            </td>
                            <td>
                                <StatusBadge status={e.status} deferred={!!e.deferredUntil} />
                                <div className="record-author">{e.authorName ?? '—'}</div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            <div className="registry-footer">
                <span>Показано {p.rows.length}</span>
                <span>Обновление без перестановки строк</span>
            </div>
        </section>
    );
}