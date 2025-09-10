import { useEffect, useState } from 'react';
import Link from 'next/link';
import { gqlAuth } from '../lib/graphql';

type User = { id: string; email: string; role: string; createdAt: string };

export default function Users() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [users, setUsers] = useState<User[]>([]);

  async function refresh() {
    if (!token) return;
    const query = `query { users { items { id email role createdAt } } }`;
    const data = await gqlAuth<{ users: { items: User[] } }>(query, token);
    setUsers(data.users.items);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function setRole(id: string, role: string) {
    if (!token) return;
    const mutation = `mutation($id: String!, $role: String!) { setUserRole(id: $id, role: $role) }`;
    await gqlAuth(mutation, token, { id, role });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
      </div>
      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{u.role}</td>
                  <td className="py-2">
                    <select
                      className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                      value={u.role}
                      onChange={(e) => setRole(u.id, e.target.value)}
                    >
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="operator">operator</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-sm">
        <Link href="/" className="text-gray-600 dark:text-gray-300">
          Back to Home
        </Link>
      </p>
    </div>
  );
}
