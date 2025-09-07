const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

export async function gql<T = any>(query: string, variables?: Record<string, any>) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as unknown as GraphQLResponse<T>;
  if (json?.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || 'GraphQL error');
  }
  return (json?.data ?? ({} as T)) as T;
}

export async function gqlAuth<T = any>(query: string, token: string, variables?: Record<string, any>) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as unknown as GraphQLResponse<T>;
  if (json?.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || 'GraphQL error');
  }
  return (json?.data ?? ({} as T)) as T;
}
