import type { AppProps } from 'next/app';
import { ThemeProvider } from '@dispatch/ui';
import '@dispatch/ui/styles/tokens.css';
import '@dispatch/ui/styles/components.css';

export default function App({ Component, pageProps }: AppProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';
  return (
    <ThemeProvider apiUrl={apiUrl}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
