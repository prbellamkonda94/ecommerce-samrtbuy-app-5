// Business metrics for the checkout flow. Built on the @opentelemetry/api
// facade, which is a safe no-op until a MeterProvider is registered -- so
// these calls cost nothing and export nothing unless OTEL_ENABLED=true
// (see server/otel/instrumentation.mjs).
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('smartbuy-api');

export const ordersPlacedCounter = meter.createCounter('smartbuy.orders.placed', {
  description: 'Number of orders successfully placed',
});

export const orderValueHistogram = meter.createHistogram('smartbuy.orders.value', {
  description: 'Order total value at checkout',
  unit: 'USD',
});

export const checkoutErrorsCounter = meter.createCounter('smartbuy.checkout.errors', {
  description: 'Checkout attempts rejected before an order was created, by reason',
});
