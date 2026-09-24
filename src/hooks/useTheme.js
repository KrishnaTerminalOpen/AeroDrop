import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('aerodrop_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) {}
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem('aerodrop_theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolved = () => {
      let active = theme;
      if (theme === 'system') {
        active = mediaQuery.matches ? 'dark' : 'light';
      }
      setResolvedTheme(active);
      if (active === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    updateResolved();

    const handleChange = () => {
      if (theme === 'system') {
        updateResolved();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('aerodrop_theme', next);
    } catch (e) {}
  };

  const setExplicitTheme = (mode) => {
    setTheme(mode);
    try {
      if (mode === 'system') {
        localStorage.removeItem('aerodrop_theme');
      } else {
        localStorage.setItem('aerodrop_theme', mode);
      }
    } catch (e) {}
  };

  return {
    theme,
    resolvedTheme,
    toggleTheme,
    setTheme: setExplicitTheme,
  };
}
