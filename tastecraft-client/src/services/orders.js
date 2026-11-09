import { apiRequest } from './api.js';
import { authRequest } from './auth.js';

// POST /api/orders/quote — public live pricing.
export function quoteOrder(payload, options = {}) {
  return apiRequest('/orders/quote', {
    method: 'POST',
    body: payload,
    ...options,
  });
}

// POST /api/orders — Customer only (Bearer handled by auth.js).
export function createOrder(payload) {
  return authRequest('/orders', {
    method: 'POST',
    body: payload,
  });
}

// GET /api/orders/my — current customer's orders.
export function getMyOrders() {
  return authRequest('/orders/my');
}

// GET /api/orders/{id}
export function getOrder(id) {
  return authRequest(`/orders/${id}`);
}

// GET /api/orders/{orderId}/review — existing review (404 if none).
export function getOrderReview(orderId, options = {}) {
  return authRequest(`/orders/${orderId}/review`, options);
}

// POST /api/orders/{orderId}/review — rate a completed order.
export function createOrderReview(orderId, review) {
  return authRequest(`/orders/${orderId}/review`, {
    method: 'POST',
    body: review,
  });
}