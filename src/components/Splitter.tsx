import { useCallback, useRef } from 'react';

interface Props {
    value: number;
    onChange: (v: number) => void;
}

export function Splitter({ value, onChange }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
    }, []);

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!dragging.current) return;
            const layout = ref.current?.parentElement?.getBoundingClientRect();
            if (!layout) return;
            const pct = ((layout.right - e.clientX) / layout.width) * 100;
            onChange(Math.min(56, Math.max(34, pct)));
        },
        [onChange],
    );

    const stop = () => (dragging.current = false);

    return (
        <div
            ref={ref}
            className="splitter"
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={34}
            aria-valuemax={56}
            aria-valuenow={Math.round(value)}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stop}
            onPointerCancel={stop}
            onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') onChange(Math.min(56, value + 2));
                if (e.key === 'ArrowRight') onChange(Math.max(34, value - 2));
            }}
        />
    );
}