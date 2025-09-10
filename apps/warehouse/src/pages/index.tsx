import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';

  async function login() {
    setError(null);
    try {
      const query = `mutation Login($input: LoginInput!) { login(input: $input) { token userId tenantId } }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { input: { email, password } } }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Login failed');
      const token = json.data.login.token as string;
      localStorage.setItem('token', token);
      window.location.href = '/scan';
    } catch (e: any) {
      setError(e.message || 'Login failed');
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Warehouse Scanner</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 320 }}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={login}>Login</button>
      </div>
    </main>
  );
}
