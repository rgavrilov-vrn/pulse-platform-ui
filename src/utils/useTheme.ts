import { useCallback, useEffect, useState } from 'react';

const KEY = 'arm-theme';

export function useTheme() {
    const [mode, setMode] = useState<'light' | 'dark'>(() =>
        document.documentElement.dataset.bsTheme === 'dark' ? 'dark' : 'light',
    );

    useEffect(() => {
        document.documentElement.dataset.bsTheme = mode;
        localStorage.setItem(KEY, mode);
    }, [mode]);

    const toggle = useCallback(
        () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
        [],
    );

    return { mode, toggle };
}