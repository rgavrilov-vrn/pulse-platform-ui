import { format, formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Europe/Moscow';

export function toMoscow(d: string | Date): Date {
    return toZonedTime(typeof d === 'string' ? new Date(d) : d, TZ);
}

export function moscowTime(d: string | null | undefined): string {
    if (!d) return '—';
    return format(toMoscow(d), 'HH:mm');
}

export function moscowDate(d: string | null | undefined): string {
    if (!d) return '';
    return format(toMoscow(d), 'dd.MM.yyyy');
}

export function fullTime(d: string | null | undefined): string {
    if (!d) return 'Нет данных';
    return format(toMoscow(d), 'dd.MM.yyyy HH:mm');
}

export function relative(d: string | null | undefined): string {
    if (!d) return 'Регистрация не указана';
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60_000) return 'только что';
    return formatDistanceToNowStrict(new Date(d), { locale: ru, addSuffix: true });
}

/** datetime-local input: '2026-10-01T11:28' (в Europe/Moscow). */
export function toDateTimeLocal(d: string | null | undefined): string {
    if (!d) return '';
    return format(toMoscow(d), "yyyy-MM-dd'T'HH:mm");
}

/** datetime-local + Europe/Moscow → ISO UTC. */
export function fromDateTimeLocal(value: string): string {
    if (!value) return '';
    // V8 парсит '2026-10-01T11:28' как локальное время браузера.
    // Явно добавляем оффсет Москвы (UTC+3, без DST с 2014).
    return new Date(`${value}:00+03:00`).toISOString();
}

/** Русская плюрализация: plural(2, ['снимок', 'снимка', 'снимков']). */
export function plural(n: number, forms: [string, string, string]): string {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return `${n} ${forms[2]}`;
    if (b > 1 && b < 5) return `${n} ${forms[1]}`;
    if (b === 1) return `${n} ${forms[0]}`;
    return `${n} ${forms[2]}`;
}