const BASE = '/api';

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.status === 204 ? null : res.json();
}

export const fetchProducts = () => request('/products');
export const fetchProduct = (id) => request(`/products/${id}`);
export const fetchOrders = () => request('/orders');
export const fetchOrder = (id) => request(`/orders/${id}`);
export const createOrder = (payload) =>
  request('/orders', { method: 'POST', body: JSON.stringify(payload) });
