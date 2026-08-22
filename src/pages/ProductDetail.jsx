import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext';
import { useCart } from '../context/CartContext';
import StarRating from '../components/StarRating';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProductById, loading, error } = useProducts();
  const product = getProductById(id);
  const { addToCart } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (loading) {
    return (
      <div className="container">
        <p className="empty-state">Loading product…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container">
        <p className="empty-state">{error ? `Couldn't load product: ${error}` : 'Product not found.'}</p>
        <Link to="/products" className="btn btn-primary">Back to Shop</Link>
      </div>
    );
  }

  const handleAdd = () => {
    addToCart(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleBuyNow = () => {
    addToCart(product.id, qty);
    navigate('/cart');
  };

  return (
    <div className="container">
      <nav className="breadcrumb">
        <Link to="/products">Shop</Link> / <span>{product.category}</span> / <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-detail-media" style={{ background: product.color }}>
          <span className="product-detail-emoji">{product.emoji}</span>
        </div>

        <div className="product-detail-info">
          <span className="product-category">{product.category}</span>
          <h1>{product.name}</h1>
          <StarRating rating={product.rating} />
          <p className="product-detail-price">${product.price.toFixed(2)}</p>
          <p className="product-detail-description">{product.description}</p>
          <p className={`stock-status ${product.stock === 0 ? 'out' : 'in'}`}>
            {product.stock === 0 ? 'Out of stock' : `In stock (${product.stock} available)`}
          </p>

          {product.stock > 0 && (
            <div className="qty-selector">
              <label htmlFor="qty">Quantity</label>
              <div className="qty-controls">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
                <input
                  id="qty"
                  type="number"
                  min="1"
                  max={product.stock}
                  value={qty}
                  onChange={(e) =>
                    setQty(Math.min(product.stock, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
                <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} aria-label="Increase quantity">+</button>
              </div>
            </div>
          )}

          <div className="product-detail-actions">
            <button className="btn btn-secondary" onClick={handleAdd} disabled={product.stock === 0}>
              {added ? 'Added ✓' : 'Add to Cart'}
            </button>
            <button className="btn btn-primary" onClick={handleBuyNow} disabled={product.stock === 0}>
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
