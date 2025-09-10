import { createClient } from 'graphql-ws';

export function makeWsClient() {
  const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql').replace(
    'http',
    'ws',
  );
  return createClient({ url });
}

export function subscribe<T = any>(
  client: ReturnType<typeof makeWsClient>,
  query: string,
  variables: any,
  onData: (data: T) => void,
  onError?: (err: any) => void,
) {
  const dispose = client.subscribe<{ data?: T; errors?: any }>(
    { query, variables },
    {
      next: (msg) => {
        if ((msg as any).data) onData((msg as any).data as T);
      },
      error: (err) => onError?.(err),
      complete: () => {},
    },
  );
  return dispose;
}
