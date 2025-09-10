import React, { useEffect, useMemo, useState } from 'react';

export type TenantTheme = 'default' | 'acme' | 'nova' | 'orchid';

function getJwtPayload(token?: string | null): any | null {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    const jsonStr = typeof atob === 'function' ? decodeURIComponent(escape(atob(payload))) : '';
    const json = jsonStr ? JSON.parse(jsonStr) : {};
    return json;
  } catch {
    return null;
  }
}

function storageKey(tenantId: string) {
  return `tenantTheme:${tenantId}`;
}

export function ThemeProvider({
  children,
  apiUrl,
}: {
  children: React.ReactNode;
  apiUrl?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<TenantTheme>('default');
  const [tenantId, setTenantId] = useState<string | null>(null);

  const token = useMemo(
    () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null),
    [],
  );

  useEffect(() => {
    setMounted(true);
    const payload = getJwtPayload(token);
    const tId = (payload?.tenantId as string) || null;
    setTenantId(tId);
    // 1) Try server theme via whoami
    (async () => {
      try {
        if (tId && apiUrl && token) {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ query: 'query { whoami { tenantId theme } }' }),
          });
          const json = await res.json();
          const serverTheme = json?.data?.whoami?.theme as TenantTheme | undefined;
          if (serverTheme && ['default', 'acme', 'nova', 'orchid'].includes(serverTheme)) {
            setTheme(serverTheme);
            try {
              localStorage.setItem(storageKey(tId), serverTheme);
            } catch {}
            return;
          }
        }
      } catch {}
      // 2) Fallback to localStorage
      if (tId) {
        const saved =
          typeof window !== 'undefined'
            ? (localStorage.getItem(storageKey(tId)) as TenantTheme | null)
            : null;
        if (saved) setTheme(saved);
      }
    })();
  }, [token, apiUrl]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }, [mounted, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        tenantId,
        setTheme: (next: TenantTheme) => {
          setTheme(next);
          if (tenantId)
            try {
              localStorage.setItem(storageKey(tenantId), next);
            } catch {}
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const ThemeContext = React.createContext<{
  theme: TenantTheme;
  tenantId: string | null;
  setTheme: (t: TenantTheme) => void;
}>({ theme: 'default', tenantId: null, setTheme: () => {} });
