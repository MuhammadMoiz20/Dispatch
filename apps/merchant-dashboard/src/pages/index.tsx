import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Dispatch Merchant Dashboard</h1>
      <AuthBar />
      <p>Welcome. Health: query via api-gateway / GraphQL.</p>
      <div style={{ marginTop: 16 }}>
        <Link href="/login" style={{ marginRight: 8 }}>
          <button>Login</button>
        </Link>
        <Link href="/signup" style={{ marginRight: 8 }}>
          <button>Signup</button>
        </Link>
        <Link href="/orders">
          <button>Orders</button>
        </Link>
      </div>
    </main>
  );
}

function AuthBar() {
  if (typeof window === 'undefined') return null as any;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return null as any;
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => {
          localStorage.removeItem('token');
          window.location.reload();
        }}
      >
        Logout
      </button>
    </div>
  );
}
