import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type NavItem = { href: string; label: string; roles?: string[] };

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/shipments', label: 'Shipments' },
  { href: '/orders', label: 'Orders' },
  { href: '/returns', label: 'Returns' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/webhooks', label: 'Webhooks', roles: ['owner', 'admin'] },
  { href: '/users', label: 'Users', roles: ['owner', 'admin'] },
  { href: '/rules', label: 'Rules', roles: ['owner', 'admin'] },
  { href: '/notifications', label: 'Notifications', roles: ['owner', 'admin'] },
  { href: '/integrations', label: 'Integrations', roles: ['owner', 'admin'] },
  { href: '/settings', label: 'Settings', roles: ['owner', 'admin'] },
];

function parseJwt(token?: string | null): { role?: string | null } {
  if (!token) return {} as any;
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    return { role: (json?.role as string) || null };
  } catch {
    return {} as any;
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const p = parseJwt(t);
    setRole((p.role || '').toLowerCase());
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      <aside
        className={`fixed z-30 inset-y-0 left-0 w-64 transform bg-white dark:bg-gray-900 border-r border-gray-200/70 dark:border-gray-800 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="h-14 px-4 flex items-center border-b border-gray-200/70 dark:border-gray-800">
          <Link href="/" className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Dispatch
          </Link>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto">
          {NAV.filter((it) => !it.roles || it.roles.includes(role || '')).map((item) => {
            const active =
              item.href === '/'
                ? router.pathname === '/'
                : router.pathname === item.href || router.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm ${active ? 'bg-brand-50 text-brand-700 dark:bg-gray-800 dark:text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 md:pl-64">
        <header className="sticky top-0 z-20 h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200/70 dark:border-gray-800 flex items-center justify-between px-4">
          <button
            className="md:hidden btn-secondary"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            Menu
          </button>
          <div className="hidden md:block text-sm text-gray-600 dark:text-gray-300">
            {role ? `Role: ${role}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              className="btn-secondary"
              onClick={() => {
                try {
                  localStorage.removeItem('token');
                } catch (e) {
                  console.error(e);
                }
                router.replace('/login');
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const pref = localStorage.getItem('theme');
      const systemDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldDark = pref ? pref === 'dark' : systemDark;
      if (shouldDark) document.documentElement.classList.add('dark');
      setIsDark(shouldDark);
    }
  }, []);
  if (!mounted) return null;
  return (
    <button
      className="btn-secondary"
      onClick={() => {
        const el = document.documentElement;
        const next = !isDark;
        if (next) el.classList.add('dark');
        else el.classList.remove('dark');
        try {
          localStorage.setItem('theme', next ? 'dark' : 'light');
        } catch (e) {
          /* ignore */
        }
        setIsDark(next);
      }}
    >
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}
