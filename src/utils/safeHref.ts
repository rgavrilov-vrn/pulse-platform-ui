export function safeHref(raw: string | null | undefined): string {
    if (!raw) return '#';
    try {
        const u = new URL(raw, window.location.href);
        return ['http:', 'https:'].includes(u.protocol) ? u.href : '#';
    } catch {
        return '#';
    }
}