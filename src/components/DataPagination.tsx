import './DataPagination.css';
interface Props {
    page: number; size: number; totalElements?: number; totalPages?: number;
    rowCount: number; loading: boolean; label: string;
    onPageChange: (page: number) => void; onSizeChange: (size: number) => void;
}
export function DataPagination({ page, size, totalElements, totalPages, rowCount, loading, label, onPageChange, onSizeChange }: Props) {
    const available = totalElements !== undefined && totalPages !== undefined;
    const first = available && rowCount ? page * size + 1 : 0;
    const last = rowCount ? first + rowCount - 1 : 0;
    const busy = loading || !available;
    const previous = page > 0;
    const next = page + 1 < (totalPages ?? 0);
    return <footer className="data-pagination">
        <span role="status" aria-live="polite">{loading ? 'Обновление…' : available ? `Показано ${first}–${last} из ${totalElements}` : 'Данные недоступны'}</span>
        <label>Строк на странице<select className="form-control" value={size} disabled={loading} onChange={e => onSizeChange(Number(e.target.value))}>
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select></label>
        <nav aria-label={label}>
            <button type="button" className="btn btn-outline-secondary" disabled={busy || !previous} onClick={() => onPageChange(0)} aria-label="Первая страница">«</button>
            <button type="button" className="btn btn-outline-secondary" disabled={busy || !previous} onClick={() => onPageChange(Math.max(0, page - 1))}>Назад</button>
            <span>{available ? `Страница ${totalPages ? page + 1 : 0} из ${totalPages}` : '—'}</span>
            <button type="button" className="btn btn-outline-secondary" disabled={busy || !next} onClick={() => onPageChange(page + 1)}>Далее</button>
            <button type="button" className="btn btn-outline-secondary" disabled={busy || !next} onClick={() => onPageChange(Math.max(0, (totalPages ?? 1) - 1))} aria-label="Последняя страница">»</button>
        </nav>
    </footer>;
}
