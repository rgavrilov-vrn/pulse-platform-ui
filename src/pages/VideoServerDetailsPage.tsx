import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { VideoPager } from '../components/VideoServerWidgets';
import './VideoServerDetailsPage.css';
import './VideoServerCollapse.css';

// Demonstration data only; not an API contract or a live equipment status.
interface DemoRow { id: string; name: string; status: string; area: string; detail: string; cameraId?: string; time?: string }
type BlockId = 'info' | 'cameras' | 'channels' | 'events';
const allOpen = () => ({ info: true, cameras: true, channels: true, events: true });
const areas = ['Главный вход', 'Периметр', 'Склад', 'Перегрузочная рампа'];
const cameras: DemoRow[] = Array.from({ length: 36 }, (_, i) => ({
    id: `demo-camera-${i + 1}`, name: `Камера ${String(i + 1).padStart(2, '0')}`,
    status: i % 9 === 0 ? 'Не в сети' : 'В сети', area: areas[i % areas.length], detail: `CAM-${String(i + 1).padStart(3, '0')} · Демонстрационная камера`,
}));
const channels: DemoRow[] = Array.from({ length: 48 }, (_, i) => ({
    id: `demo-channel-${i + 1}`, name: `Канал ${String(i + 1).padStart(2, '0')}`,
    status: i % 7 === 0 ? 'Отключён' : 'Активен', area: cameras[i % cameras.length].name,
    detail: i % 2 ? 'Дополнительный поток · 640×360' : 'Основной поток · 1920×1080', cameraId: cameras[i % cameras.length].id,
}));
const events: DemoRow[] = Array.from({ length: 96 }, (_, i) => ({
    id: `demo-event-${i + 1}`, name: ['Движение', 'Потеря связи', 'Связь восстановлена', 'Пересечение линии'][i % 4],
    status: i % 11 === 0 ? 'Ошибка' : i % 4 === 1 ? 'Предупреждение' : 'Информация',
    area: cameras[i % cameras.length].name, cameraId: cameras[i % cameras.length].id,
    detail: `Тестовая запись ${i + 1}`, time: new Date(Date.UTC(2026, 9, 30, 12, 0, 0) - i * 180000).toISOString(),
}));
const formatter = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'medium' });
function BlockHeading({ id, title, expanded, onToggle, summary }: {
    id: string; title: string; expanded: boolean; onToggle: () => void; summary: ReactNode;
}) {
    return <div className="vsd-collapse-heading"><h2 id={`${id}-title`}>
        <button type="button" className="vsd-collapse-button" aria-expanded={expanded} aria-controls={`${id}-body`} onClick={onToggle}>
            <span>{title}</span><span className="vsd-collapse-summary">{summary}</span>
            <svg className={expanded ? 'vsd-chevron expanded' : 'vsd-chevron'} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
    </h2></div>;
}
function DemoTable({ id, title, rows, expanded, onToggle, eventMode = false, cameraId = '', onCamera, beforeTools }: {
    id: string; title: string; rows: DemoRow[]; expanded: boolean; onToggle: () => void;
    eventMode?: boolean; cameraId?: string; onCamera?: (id: string) => void; beforeTools?: ReactNode;
}) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [sort, setSort] = useState('default');
    useEffect(() => setPage(0), [cameraId]);
    const filtered = useMemo(() => {
        const q = search.trim().toLocaleLowerCase('ru');
        const result = rows.filter((row) => (!cameraId || row.cameraId === cameraId)
            && (!status || row.status === status)
            && (!q || `${row.id} ${row.name} ${row.area} ${row.detail}`.toLocaleLowerCase('ru').includes(q)));
        if (sort === 'asc' || sort === 'desc') result.sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }) * (sort === 'asc' ? 1 : -1));
        else if (eventMode) result.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
        return result;
    }, [rows, search, status, sort, eventMode, cameraId]);
    const totalPages = Math.ceil(filtered.length / size);
    const current = Math.min(page, Math.max(0, totalPages - 1));
    const content = filtered.slice(current * size, (current + 1) * size);
    const options = Array.from(new Set(rows.map((row) => row.status)));
    return <section id={id} className="vsd-section" aria-labelledby={`${id}-title`}>
        <BlockHeading id={id} title={title} expanded={expanded} onToggle={onToggle} summary={`${filtered.length} из ${rows.length} · демо`} />
        <div id={`${id}-body`} hidden={!expanded}>
            {beforeTools}
            <div className="vsd-tools">
                <label className="vsd-search">Поиск<input type="search" className="form-control" value={search} placeholder="Название, размещение или ID"
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></label>
                <label>{eventMode ? 'Критичность' : 'Состояние'}<select className="form-control" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
                    <option value="">Все</option>{options.map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Порядок<select className="form-control" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }}>
                    <option value="default">{eventMode ? 'Сначала новые' : 'По номеру'}</option><option value="asc">Название: А–Я</option><option value="desc">Название: Я–А</option></select></label>
                <button type="button" className="btn btn-outline-secondary" onClick={() => { setSearch(''); setStatus(''); setSort('default'); setPage(0); }}>Сбросить</button>
            </div>
            <div className="vsd-table-scroll"><table className="vsd-table"><thead><tr>
                {eventMode && <th scope="col">Время (МСК)</th>}<th scope="col">{eventMode ? 'Событие' : 'Название'}</th>
                <th scope="col">{eventMode ? 'Критичность' : 'Состояние'}</th><th scope="col">{id === 'cameras' ? 'Размещение' : 'Камера'}</th>
                <th scope="col">{onCamera ? 'Действие' : 'Описание'}</th></tr></thead><tbody>
                {!content.length && <tr><td colSpan={eventMode ? 5 : 4}>По выбранным условиям ничего не найдено. Измените поиск или фильтр.</td></tr>}
                {content.map((row) => <tr key={row.id}>
                    {eventMode && <td><time dateTime={row.time}>{formatter.format(new Date(row.time!))}</time></td>}
                    <td><strong>{row.name}</strong><small>{row.id}</small></td><td><span className={`vsd-badge ${['Не в сети', 'Ошибка'].includes(row.status) ? 'bad' : ['Отключён', 'Предупреждение'].includes(row.status) ? 'warn' : 'good'}`}>{row.status}</span></td>
                    <td>{row.area}</td><td>{onCamera ? <button type="button" className="vsd-text-button" onClick={() => onCamera(row.id)}>События камеры →</button> : row.detail}</td>
                </tr>)}
            </tbody></table></div>
            <VideoPager data={{ content, page: current, size, totalElements: filtered.length, totalPages, hasNext: current + 1 < totalPages, hasPrevious: current > 0 }}
                size={size} fetching={false} onPage={setPage} onSize={(value) => { setSize(value); setPage(0); }} />
        </div>
    </section>;
}
export function VideoServerDetailsPage() {
    const { serverId = 'demo' } = useParams();
    const location = useLocation();
    const navigation = location.state as { displayName?: string; registry?: unknown } | null;
    const name = navigation?.displayName || 'Демонстрационный видеосервер';
    const [cameraId, setCameraId] = useState('');
    const [expanded, setExpanded] = useState(allOpen);
    const [target, setTarget] = useState<'cameras' | 'channels' | 'events' | null>(null);
    useEffect(() => { setCameraId(''); setExpanded(allOpen()); setTarget(null); }, [serverId]);
    useEffect(() => {
        if (!target) return;
        const frame = requestAnimationFrame(() => {
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            document.getElementById(target)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
            setTarget(null);
        });
        return () => cancelAnimationFrame(frame);
    }, [target]);
    function toggle(id: BlockId) { setExpanded((value) => ({ ...value, [id]: !value[id] })); }
    function goTo(id: 'cameras' | 'channels' | 'events') {
        setExpanded((value) => ({ ...value, [id]: true })); setTarget(id);
    }
    function showCamera(id: string) { setCameraId(id); goTo('events'); }
    async function copyId() {
        try { await navigator.clipboard.writeText(serverId); toast.success('ID скопирован'); }
        catch { toast.error('Не удалось скопировать. Выделите ID вручную.'); }
    }
    return <><Header /><div className="app-body vsd-app"><Sidebar /><main className="workspace vsd-workspace" data-info-collapsed={!expanded.info}>
        <div className="page-heading"><div><div className="breadcrumb-line"><Link to="/video-servers" state={{ registry: navigation?.registry }}>Видеосерверы</Link><span>/</span>Карточка сервера</div>
            <h1>{name}</h1></div><Link className="btn btn-outline-secondary" to="/video-servers" state={{ registry: navigation?.registry }}>← К реестру</Link></div>
        <div className="vsd-demo" role="note">Демонстрационный режим. Информация об оборудовании, статусы и все записи ниже — тестовые. Карточка не запрашивает API и не изменяет сервер.</div>
        <section id="info" className="vsd-section vsd-info" aria-labelledby="info-title">
            <BlockHeading id="info" title="Информация о сервере" expanded={expanded.info} onToggle={() => toggle('info')} summary={<span className="vsd-badge good">В сети · демо</span>} />
            <div id="info-body" hidden={!expanded.info}>
                <dl className="vsd-info-grid"><div><dt>ID из ссылки</dt><dd className="vsd-id">{serverId} <button type="button" className="vsd-text-button" onClick={() => void copyId()}>Копировать</button></dd></div>
                    <div><dt>Активность</dt><dd>Активен · демо</dd></div><div><dt>Источник / внешний ID</dt><dd>DEMO / demo-server-01</dd></div>
                    <div><dt>Host / Base URL</dt><dd>vms-demo.example / https://vms-demo.example</dd></div><div><dt>Объект / зона</dt><dd>Демо-площадка / Тестовая зона</dd></div>
                    <div><dt>Описание</dt><dd>Макет рабочего места для просмотра камер, каналов и событий. Значения не относятся к выбранному оборудованию.</dd></div>
                </dl>
                <div className="vsd-metrics"><a href="#cameras" onClick={(e) => { e.preventDefault(); goTo('cameras'); }}><strong>{cameras.length}</strong><span>Камер · демо</span></a>
                    <a href="#channels" onClick={(e) => { e.preventDefault(); goTo('channels'); }}><strong>{channels.length}</strong><span>Каналов · демо</span></a>
                    <a href="#events" onClick={(e) => { e.preventDefault(); goTo('events'); }}><strong>{events.length}</strong><span>Событий · демо</span></a></div>
            </div>
        </section>
        <nav className="vsd-anchor-nav" aria-label="Блоки карточки">
            <a href="#cameras" onClick={(e) => { e.preventDefault(); goTo('cameras'); }}>Камеры</a>
            <a href="#channels" onClick={(e) => { e.preventDefault(); goTo('channels'); }}>Каналы</a>
            <a href="#events" onClick={(e) => { e.preventDefault(); goTo('events'); }}>События</a>
            <span>Нажмите заголовок блока, чтобы свернуть или развернуть</span>
        </nav>
        <DemoTable id="cameras" title="Камеры" rows={cameras} expanded={expanded.cameras} onToggle={() => toggle('cameras')} onCamera={showCamera} />
        <DemoTable id="channels" title="Каналы" rows={channels} expanded={expanded.channels} onToggle={() => toggle('channels')} />
        <DemoTable id="events" title="События" rows={events} eventMode cameraId={cameraId} expanded={expanded.events} onToggle={() => toggle('events')}
            beforeTools={<div className="vsd-camera-filter"><label>События камеры<select className="form-control" value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
                <option value="">Все камеры</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name} · {camera.area}</option>)}</select></label>
                {cameraId && <button type="button" className="vsd-text-button" onClick={() => setCameraId('')}>Показать все камеры</button>}</div>} />
    </main></div></>;
}
