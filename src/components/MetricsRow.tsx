interface Props {
    total: number;
    drafts: number;
    incidents: number;
    myPublished: number;
}

export function MetricsRow({ total, drafts, incidents, myPublished }: Props) {
    return (
        <section className="metrics" aria-label="Показатели смены">
            <div className="metric">
                <span className="metric-icon">▤</span>
                <div><span>В выборке</span><strong>{total}</strong></div>
            </div>
            <div className="metric">
                <span className="metric-icon amber">◐</span>
                <div><span>Ожидают обработки</span><strong>{drafts}</strong></div>
            </div>
            <div className="metric">
                <span className="metric-icon red">▲</span>
                <div><span>Инциденты</span><strong>{incidents}</strong></div>
            </div>
            <div className="metric shift-metric">
                <span className="metric-icon">✓</span>
                <div><span>Мои публикации</span><strong>{myPublished}</strong></div>
            </div>
        </section>
    );
}