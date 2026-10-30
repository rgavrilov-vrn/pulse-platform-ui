import { useState } from 'react';
import { Header } from '../components/Header';
import { MetricsRow } from '../components/MetricsRow';
import { EventTable, type Filter } from '../components/EventTable';
import { EventCard } from '../components/EventCard';
import { Splitter } from '../components/Splitter';
import { useIncidents } from '../hooks/useIncidents';
import { useCatalog } from '../hooks/useCatalog';
import { useDebounce } from '../hooks/useDebounce';
import type { IncidentStatus } from '../api/types';

function statusesFor(filter: Filter): IncidentStatus[] | undefined {
    switch (filter) {
        case 'draft': return ['DRAFT'];
        case 'published': return ['RECORDED', 'CONFIRMED', 'CLOSED', 'ARCHIVED'];
        case 'cancelled': return ['CANCELLED'];
        default: return undefined;
    }
}

export function RegistryPage() {
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [mineOnly, setMineOnly] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [cardWidth, setCardWidth] = useState(42);

    const debounced = useDebounce(search, 150);

    const list = useIncidents({
        statuses: statusesFor(filter),
        kind: undefined,
        search: debounced || undefined,
        mineOnly,
        deferred: filter === 'deferred' ? true : undefined,
        size: 100,
    });

    const catalog = useCatalog();

    const selected =
        list.data?.content.find((i) => i.id === selectedId) ?? list.data?.content[0];

    const draftsCount = list.data?.content.filter((i) => i.status === 'DRAFT' && !i.deferredUntil).length ?? 0;
    const incidentsCount = list.data?.content.filter((i) => i.kind === 'incident').length ?? 0;
    const myPublished = list.data?.content.filter((i) => i.status === 'RECORDED').length ?? 0;

    return (
        <>
            <Header />
            <div className="app-body">
                <nav className="rail" aria-label="Разделы">
                    <button className="rail-btn active" title="Реестр событий">▤</button>
                </nav>
                <main className="workspace">
                    <div className="page-heading">
                        <div>
                            <div className="breadcrumb-line">
                                Ситуационный центр <span>/</span> Оперативная работа
                            </div>
                            <h1>События <span className="live-indicator"><span /> Просмотр</span></h1>
                        </div>
                    </div>

                    <MetricsRow
                        total={list.data?.totalElements ?? 0}
                        drafts={draftsCount}
                        incidents={incidentsCount}
                        myPublished={myPublished}
                    />

                    <div
                        className="split-layout"
                        style={{ '--card-width': `${cardWidth}%` } as React.CSSProperties}
                    >
                        <EventTable
                            rows={list.data?.content ?? []}
                            loading={list.isLoading}
                            error={list.error}
                            selectedId={selected?.id ?? null}
                            filter={filter}
                            onFilterChange={setFilter}
                            search={search}
                            onSearchChange={setSearch}
                            mineOnly={mineOnly}
                            onMineOnlyChange={setMineOnly}
                            onSelect={setSelectedId}
                        />
                        <Splitter value={cardWidth} onChange={setCardWidth} />
                        {selected ? (
                            <EventCard
                                key={selected.id}
                                incident={selected}
                                catalog={catalog.data}
                            />
                        ) : (
                            <aside className="event-card panel">
                                <div className="empty-state">Выберите событие</div>
                            </aside>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}