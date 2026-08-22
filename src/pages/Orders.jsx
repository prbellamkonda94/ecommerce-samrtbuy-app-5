import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrders } from '../api/client';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders()
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container">
        <p className="empty-state">Loading orders…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <p className="empty-state">Couldn't load orders: {error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <p>You haven't placed any orders yet.</p>
          <Link to="/products" className="btn btn-primary">Start Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>My Orders</h1>
      <div className="orders-list">
        {orders.map((order) => (
          <div className="order-card" key={order.id}>
            <div className="order-card-header">
              <div>
                <p className="order-id">{order.id}</p>
                <p className="order-date">{new Date(order.placedAt).toLocaleString()}</p>
              </div>
              <span className="order-status">{order.status}</span>
            </div>
            <p>{order.items.length} item{order.items.length !== 1 ? 's' : ''} · ${order.total.toFixed(2)}</p>
            <Link to={`/order-confirmation/${order.id}`} className="btn btn-text">View details →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
