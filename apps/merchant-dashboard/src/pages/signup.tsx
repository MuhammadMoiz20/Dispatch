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
    <div className="min-h-[calc(100vh-56px)] grid place-items-center">
      <div className="card w-full max-w-md">
        <div className="card-header">Create your account</div>
        <div className="card-body">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm text-gray-600 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-gray-600 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              />
            </div>
            <div>
              <label
                htmlFor="tenantName"
                className="block text-sm text-gray-600 dark:text-gray-300"
              >
                Tenant Name
              </label>
              <input
                id="tenantName"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                type="text"
                required
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-700 dark:text-brand-300">
              Log in
            </Link>
          </p>
          <p className="mt-2 text-sm">
            <Link href="/" className="text-gray-600 dark:text-gray-300">
              Back to Home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
