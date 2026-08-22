import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchOrder } from '../api/client';

export default function OrderConfirmation() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchOrder(id)
      .then(setOrder)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container">
        <p className="empty-state">Loading order…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container">
        <p className="empty-state">{error || 'Order not found.'}</p>
        <Link to="/products" className="btn btn-primary">Back to Shop</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="confirmation">
        <span className="confirmation-icon">✅</span>
        <h1>Order Confirmed!</h1>
        <p>Thanks{order.shipping?.fullName ? `, ${order.shipping.fullName}` : ''} — your order has been placed.</p>
        <p className="order-id">Order ID: <strong>{order.id}</strong></p>

        <div className="order-details">
          {order.items.map((item) => (
            <div className="summary-row" key={item.productId}>
              <span>{item.name} × {item.qty}</span>
              <span>${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>

        {order.shipping && (
          <div className="shipping-info">
            <h3>Shipping to</h3>
            <p>{order.shipping.fullName}</p>
            <p>{order.shipping.address}, {order.shipping.city} {order.shipping.zip}</p>
          </div>
        )}

        <div className="confirmation-actions">
          <Link to="/orders" className="btn btn-secondary">View Orders</Link>
          <Link to="/products" className="btn btn-primary">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
