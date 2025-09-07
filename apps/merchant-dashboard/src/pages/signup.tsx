import Link from 'next/link';
import { useState } from 'react';
import { gql } from '../lib/graphql';
import { useRouter } from 'next/router';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Invalid email');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (tenantName.trim().length < 2) {
      setError('Tenant name is required');
      return;
    }
    setLoading(true);
    try {
      const mutation = `mutation Signup($input: SignupInput!) { signup(input: $input) { token userId tenantId } }`;
      const data = await gql<{ signup: { token: string } }>(mutation, {
        input: { email, password, tenantName },
      });
      localStorage.setItem('token', data.signup.token);
      router.push('/orders');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Sign Up</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={onSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        <div>
          <label htmlFor="tenantName">Tenant Name</label>
          <input id="tenantName" value={tenantName} onChange={(e) => setTenantName(e.target.value)} type="text" required />
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign Up'}</button>
      </form>
      <p style={{ marginTop: 8 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
      <p style={{ marginTop: 16 }}>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
