import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <style jsx global>{`
        body {
          font-family:
            -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
            'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        }
        button {
          cursor: pointer;
        }
        input,
        select {
          padding: 6px 8px;
        }
        .container {
          max-width: 900px;
          margin: 24px auto;
          padding: 0 16px;
        }
        .row {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .card {
          border: 1px solid #ddd;
          padding: 12px;
          border-radius: 6px;
        }
      `}</style>
    </>
  );
}
