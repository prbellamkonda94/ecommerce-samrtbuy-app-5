import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder } from '../api/client';

const emptyForm = {
  fullName: '',
  address: '',
  city: '',
  zip: '',
  cardNumber: '',
};

export default function Checkout() {
  const { items, cartDetails, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  // Set once an order is successfully placed, before navigating away.
  // React Router's route swap doesn't commit in the same render pass as
  // navigate(), so this component can render one more time with an
  // already-empty cart before it actually unmounts; without this flag that
  // extra render would trip the guard below and redirect to /cart,
  // clobbering the navigation to the confirmation page.
  const orderPlacedRef = useRef(false);

  // Guard on the raw persisted cart (`items`), not `cartDetails` -- the
  // latter is only populated once ProductsContext's product fetch
  // resolves, so on a cold load of /checkout with a non-empty cart,
  // cartDetails is briefly [] and would otherwise bounce a valid cart to
  // /cart before products finish loading.
  if (!orderPlacedRef.current && items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const shippingCost = subtotal > 50 ? 0 : 5.99;
  const total = subtotal + shippingCost;

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Full name is required';
    if (!form.address.trim()) next.address = 'Address is required';
    if (!form.city.trim()) next.city = 'City is required';
    if (!/^\d{5}(-\d{4})?$/.test(form.zip.trim())) next.zip = 'Enter a valid ZIP code';
    if (!/^\d{13,19}$/.test(form.cardNumber.replace(/\s/g, ''))) next.cardNumber = 'Enter a valid card number';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await createOrder({
        items: cartDetails.map(({ product, qty }) => ({ productId: product.id, qty })),
        shipping: {
          fullName: form.fullName,
          address: form.address,
          city: form.city,
          zip: form.zip,
        },
      });
      orderPlacedRef.current = true;
      clearCart();
      navigate(`/order-confirmation/${order.id}`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <h1>Checkout</h1>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <h2>Shipping Information</h2>
          <label>
            Full Name
            <input name="fullName" value={form.fullName} onChange={handleChange} />
            {errors.fullName && <span className="field-error">{errors.fullName}</span>}
          </label>
          <label>
            Address
            <input name="address" value={form.address} onChange={handleChange} />
            {errors.address && <span className="field-error">{errors.address}</span>}
          </label>
          <div className="form-row">
            <label>
              City
              <input name="city" value={form.city} onChange={handleChange} />
              {errors.city && <span className="field-error">{errors.city}</span>}
            </label>
            <label>
              ZIP Code
              <input name="zip" value={form.zip} onChange={handleChange} placeholder="12345" />
              {errors.zip && <span className="field-error">{errors.zip}</span>}
            </label>
          </div>

          <h2>Payment (Mock)</h2>
          <label>
            Card Number
            <input name="cardNumber" value={form.cardNumber} onChange={handleChange} placeholder="4242 4242 4242 4242" />
            {errors.cardNumber && <span className="field-error">{errors.cardNumber}</span>}
          </label>
          <p className="hint">This is a demo checkout — no real payment is processed.</p>

          {submitError && <p className="field-error">Order failed: {submitError}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Placing Order…' : `Place Order — $${total.toFixed(2)}`}
          </button>
        </form>

        <aside className="cart-summary">
          <h2>Order Summary</h2>
          {cartDetails.map(({ product, qty }) => (
            <div className="summary-row" key={product.id}>
              <span>{product.name} × {qty}</span>
              <span>${(product.price * qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
