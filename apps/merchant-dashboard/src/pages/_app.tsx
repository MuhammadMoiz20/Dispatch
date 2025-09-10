import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import '../styles/globals.css';
import '@dispatch/ui/styles/tokens.css';
import '@dispatch/ui/styles/components.css';
import { ThemeProvider } from '@dispatch/ui';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const isPublic =
    router.pathname === '/login' ||
    router.pathname === '/signup' ||
    router.pathname.startsWith('/api');

  useEffect(() => {
    try {
      const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      setToken(t);
    } catch (e) {
      console.error(e);
      setToken(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  useEffect(() => {
    if (isPublic) return;
    if (token === null) return; // not yet loaded
    if (!token) {
      const next = encodeURIComponent(router.asPath || '/');
      router.replace(`/login?next=${next}`);
    }
  }, [isPublic, token, router]);

  const content = <Component {...pageProps} />;
  const wrapped = isPublic ? content : <Layout>{content}</Layout>;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';
  return <ThemeProvider apiUrl={apiUrl}>{wrapped}</ThemeProvider>;
}
