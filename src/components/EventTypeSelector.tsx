import type { Catalog, CategoryGroup, IncidentKind } from '../api/types';
import { fromApiKind } from '../api/incidentKind';

interface Props {
    groups: CategoryGroup[] | undefined;
    value: IncidentKind | null | undefined;
    disabled?: boolean;
    error?: string;
    onChange: (kind: IncidentKind) => void;
}
export function EventTypeSelector({ groups, value, disabled, error, onChange }: Props) {
    const options = Array.isArray(groups) ? [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru')) : [];
    return <fieldset className="kind-field" disabled={disabled}>
        <legend>Тип события</legend>
        <div className="kind-switch" style={{ display: 'flex', flexWrap: 'wrap' }}>
            {options.map((group) => {
                const kind = fromApiKind(group.code);
                const selected = kind !== null && value === kind;
                return <button key={group.id} type="button" className={selected ? 'active' : ''} aria-pressed={selected}
                    disabled={kind === null} style={{ flex: '1 1 120px' }}
                    title={kind === null ? `Код группы ${group.code} не поддерживается контрактом IncidentKind` : undefined}
                    onClick={() => { if (kind !== null) onChange(kind); }}>{group.name}</button>;
            })}
        </div>
        {!options.length && <small style={{ display: 'block', marginTop: 8, color: 'var(--muted)' }}>Справочник типов события пока недоступен.</small>}
        {!value && <small style={{ display: 'block', marginTop: 8, color: 'var(--muted)' }}>Тип не указан{disabled ? '.' : '. Выберите тип перед сохранением.'}</small>}
        {error && <small className="invalid-feedback d-block" role="alert">{error}</small>}
    </fieldset>;
}
function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
export function savedCategoryNames(value: unknown, catalog?: Catalog): string[] {
    const item = record(value);
    if (!item) return [];
    const names: string[] = [];
    if (Array.isArray(item.checkpoints)) {
        for (const link of item.checkpoints) {
            const name = record(link)?.categoryName;
            if (typeof name === 'string' && name.trim()) names.push(name.trim());
        }
    }
    if (names.length) return [...new Set(names)];
    const metadata = record(item.metadata);
    const categoryId = typeof item.categoryId === 'string' ? item.categoryId : metadata?.categoryId;
    const categories = Array.isArray(catalog?.categories) ? catalog.categories : [];
    const category = categories.find((option) => option.id === categoryId);
    if (category) return [category.name];
    const name = typeof item.categoryName === 'string' ? item.categoryName : metadata?.categoryName;
    return typeof name === 'string' && name.trim() ? [name.trim()] : [];
}
