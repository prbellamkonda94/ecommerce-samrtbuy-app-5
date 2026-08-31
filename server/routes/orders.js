import { Router } from 'express';
import { sql } from '../db.js';

const router = Router();

function generateOrderId() {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function formatOrder(order, items) {
  return {
    id: order.id,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    total: Number(order.total),
    status: order.status,
    placedAt: order.placedAt,
    shipping: {
      fullName: order.shippingFullName,
      address: order.shippingAddress,
      city: order.shippingCity,
      zip: order.shippingZip,
    },
    items: items.map((i) => ({
      productId: i.productId,
      name: i.name,
      price: Number(i.price),
      qty: i.qty,
    })),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const orders = await sql`
      SELECT id, subtotal, shipping_cost AS "shippingCost", total, status,
             placed_at AS "placedAt", shipping_full_name AS "shippingFullName",
             shipping_address AS "shippingAddress", shipping_city AS "shippingCity",
             shipping_zip AS "shippingZip"
      FROM orders
      ORDER BY placed_at DESC
    `;
    const items = await sql`
      SELECT order_id AS "orderId", product_id AS "productId", name, price, qty
      FROM order_items
    `;
    const byOrder = new Map();
    for (const item of items) {
      if (!byOrder.has(item.orderId)) byOrder.set(item.orderId, []);
      byOrder.get(item.orderId).push(item);
    }
    res.json(orders.map((o) => formatOrder(o, byOrder.get(o.id) || [])));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [order] = await sql`
      SELECT id, subtotal, shipping_cost AS "shippingCost", total, status,
             placed_at AS "placedAt", shipping_full_name AS "shippingFullName",
             shipping_address AS "shippingAddress", shipping_city AS "shippingCity",
             shipping_zip AS "shippingZip"
      FROM orders
      WHERE id = ${req.params.id}
    `;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = await sql`
      SELECT order_id AS "orderId", product_id AS "productId", name, price, qty
      FROM order_items
      WHERE order_id = ${req.params.id}
    `;
    res.json(formatOrder(order, items));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { items, shipping } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must include at least one item' });
    }
    if (!shipping?.fullName?.trim() || !shipping?.address?.trim() ||
        !shipping?.city?.trim() || !shipping?.zip?.trim()) {
      return res.status(400).json({ error: 'Shipping details are required' });
    }

    const productIds = [...new Set(items.map((i) => Number(i.productId)))];
    if (productIds.some((id) => !Number.isInteger(id))) {
      return res.status(400).json({ error: 'Invalid product id in cart' });
    }

    const products = await sql`SELECT * FROM products WHERE id = ANY(${productIds})`;
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const resolvedItems = items.map((i) => {
      const product = productMap.get(Number(i.productId));
      if (!product) {
        const err = new Error(`Unknown product ${i.productId}`);
        err.status = 400;
        throw err;
      }
      const qty = Math.max(1, Math.min(product.stock, Number(i.qty) || 1));
      subtotal += Number(product.price) * qty;
      return { productId: product.id, name: product.name, price: Number(product.price), qty };
    });

    const shippingCost = subtotal > 50 ? 0 : 5.99;
    const total = subtotal + shippingCost;
    const orderId = generateOrderId();

    await sql`
      INSERT INTO orders (
        id, subtotal, shipping_cost, total,
        shipping_full_name, shipping_address, shipping_city, shipping_zip, status
      ) VALUES (
        ${orderId}, ${subtotal}, ${shippingCost}, ${total},
        ${shipping.fullName}, ${shipping.address}, ${shipping.city}, ${shipping.zip}, 'Confirmed'
      )
    `;

    for (const item of resolvedItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, name, price, qty)
        VALUES (${orderId}, ${item.productId}, ${item.name}, ${item.price}, ${item.qty})
      `;
    }

    const [order] = await sql`
      SELECT id, subtotal, shipping_cost AS "shippingCost", total, status,
             placed_at AS "placedAt", shipping_full_name AS "shippingFullName",
             shipping_address AS "shippingAddress", shipping_city AS "shippingCity",
             shipping_zip AS "shippingZip"
      FROM orders
      WHERE id = ${orderId}
    `;

    res.status(201).json(formatOrder(order, resolvedItems));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

export default router;
