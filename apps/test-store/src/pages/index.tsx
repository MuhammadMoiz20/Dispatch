import Link from 'next/link';
import { useState } from 'react';

type CartItem = { sku: string; quantity: number };

const sampleProducts = [
  { sku: 'TSHIRT-BLACK-M', name: 'T-Shirt Black (M)' },
  { sku: 'TSHIRT-WHITE-L', name: 'T-Shirt White (L)' },
  { sku: 'MUG-COFFEE', name: 'Coffee Mug' },
];

export default function Home() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (sku: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.sku === sku);
      if (existing)
        return prev.map((i) => (i.sku === sku ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { sku, quantity: 1 }];
    });
  };

  const remove = (sku: string) => setCart((prev) => prev.filter((i) => i.sku !== sku));

  return (
    <div className="container">
      <h1>Test Store</h1>
      <p>Use this lightweight shop to generate orders into your app.</p>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3>Products</h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {sampleProducts.map((p) => (
              <div key={p.sku} className="card" style={{ width: 260 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: '#666', fontSize: 12, margin: '4px 0 8px' }}>SKU: {p.sku}</div>
                <button onClick={() => addToCart(p.sku)}>Add to cart</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 340 }}>
          <h3>Cart</h3>
          {cart.length === 0 ? (
            <div className="card">Your cart is empty</div>
          ) : (
            <div className="card">
              {cart.map((i) => (
                <div key={i.sku} className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div>{i.sku}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>qty: {i.quantity}</div>
                  </div>
                  <button onClick={() => remove(i.sku)}>Remove</button>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <Link
                  href={{
                    pathname: '/checkout',
                    query: { cart: encodeURIComponent(JSON.stringify(cart)) },
                  }}
                >
                  <button>Go to checkout</button>
                </Link>
              </div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/orders">
              <button>View Orders</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
