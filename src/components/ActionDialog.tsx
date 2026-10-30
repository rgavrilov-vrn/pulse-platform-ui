import { useEffect, useRef, useState } from 'react';

interface Props {
    title: string;
    description: string;
    requireReason?: boolean;
    confirmLabel?: string;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
}

export function ActionDialog({
                                 title,
                                 description,
                                 requireReason,
                                 confirmLabel = 'Подтвердить',
                                 onConfirm,
                                 onCancel,
                             }: Props) {
    const ref = useRef<HTMLDialogElement>(null);
    const [reason, setReason] = useState('');

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (!d.open) d.showModal();
        return () => d.close();
    }, []);

    return (
        <dialog ref={ref} onCancel={onCancel}>
            <form
                method="dialog"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (requireReason && !reason.trim()) return;
                    onConfirm(reason.trim());
                }}
            >
                <div className="dialog-heading">
                    <h2>{title}</h2>
                    <button type="button" className="icon-btn" onClick={onCancel}>
                        ×
                    </button>
                </div>
                <p>{description}</p>
                {requireReason && (
                    <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Укажите причину"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                    />
                )}
                <div className="dialog-buttons">
                    <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                        Назад
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={requireReason && !reason.trim()}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </form>
        </dialog>
    );
}