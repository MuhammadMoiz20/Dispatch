const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

async function handleResponse<T>(res: Response): Promise<T> {
  let text = '';
  try {
    text = await res.text();
  } catch (e) {
    /* ignore */
  }
  let json: GraphQLResponse<T> | null = null;
  try {
    json = text ? (JSON.parse(text) as GraphQLResponse<T>) : null;
  } catch (e) {
    /* ignore */
  }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || text || `${res.status} ${res.statusText}`;
    if (res.status === 401) throw new Error('Unauthorized: please log in again');
    if (res.status === 403) throw new Error('Forbidden: your token lacks access');
    throw new Error(msg || 'Request failed');
  }

  if (json?.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || 'GraphQL error');
  }
  return (json?.data ?? ({} as T)) as T;
}

export async function gql<T = any>(query: string, variables?: Record<string, any>) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return handleResponse<T>(res);
}

export async function gqlAuth<T = any>(
  query: string,
  token: string,
  variables?: Record<string, any>,
) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  return handleResponse<T>(res);
}
