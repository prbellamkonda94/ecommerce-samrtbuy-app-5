import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { cartDetails, updateQty, removeFromCart, subtotal, clearCart } = useCart();

  if (cartDetails.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <p>Your cart is empty.</p>
          <Link to="/products" className="btn btn-primary">Continue Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Your Cart</h1>
      <div className="cart-layout">
        <div className="cart-items">
          {cartDetails.map(({ product, qty }) => (
            <div className="cart-item" key={product.id}>
              <Link to={`/products/${product.id}`} className="cart-item-media" style={{ background: product.color }}>
                <span>{product.emoji}</span>
              </Link>
              <div className="cart-item-info">
                <Link to={`/products/${product.id}`} className="product-name">{product.name}</Link>
                <span className="product-category">{product.category}</span>
                <p className="cart-item-price">${product.price.toFixed(2)} each</p>
              </div>
              <div className="qty-controls">
                <button onClick={() => updateQty(product.id, qty - 1)} aria-label="Decrease quantity">−</button>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={qty}
                  onChange={(e) => updateQty(product.id, Math.max(1, Number(e.target.value) || 1))}
                />
                <button onClick={() => updateQty(product.id, qty + 1)} aria-label="Increase quantity">+</button>
              </div>
              <p className="cart-item-total">${(product.price * qty).toFixed(2)}</p>
              <button className="remove-btn" onClick={() => removeFromCart(product.id)} aria-label="Remove item">
                ✕
              </button>
            </div>
          ))}
          <button className="btn btn-text" onClick={clearCart}>Clear cart</button>
        </div>

        <aside className="cart-summary">
          <h2>Order Summary</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>{subtotal > 50 ? 'Free' : '$5.99'}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>${(subtotal + (subtotal > 50 || subtotal === 0 ? 0 : 5.99)).toFixed(2)}</span>
          </div>
          <Link to="/checkout" className="btn btn-primary btn-block">Proceed to Checkout</Link>
          <Link to="/products" className="btn btn-text btn-block">Continue Shopping</Link>
        </aside>
      </div>
    </div>
  );
}
