'use strict';

const http = require('../http');
const { discover } = require('../broker/registry');

// Client for Delivery Order Service (Fig 22.22). Discovered under "DeliveryOrderService".
const NAME = 'DeliveryOrderService';

module.exports = {
  // store(in order, out orderId) — message M7. Returns { orderId }.
  async store(order) {
    const base = await discover(NAME);
    return http.post(`${base}/delivery-orders`, order, { serviceName: NAME });
  },

  // select(in supplierId, out order) — message D3.
  async select(supplierId) {
    const base = await discover(NAME);
    return http.get(`${base}/delivery-orders/supplier/${supplierId}/next`, { serviceName: NAME });
  },

  // read(in orderId, out order) — message V3.
  async read(orderId) {
    const base = await discover(NAME);
    return http.get(`${base}/delivery-orders/${orderId}`, { serviceName: NAME });
  },

  // update(in orderId, in order, out orderStatus). Returns { orderStatus }.
  async update(orderId, patch) {
    const base = await discover(NAME);
    return http.patch(`${base}/delivery-orders/${orderId}`, patch, { serviceName: NAME });
  },

  // requestInvoice(in orderId, out invoice) — message S5.
  async requestInvoice(orderId) {
    const base = await discover(NAME);
    return http.get(`${base}/delivery-orders/${orderId}/invoice`, { serviceName: NAME });
  },

  // prepareToCommitOrder(in orderId, out order) — message S4 (Prepare To Commit).
  async prepareToCommitOrder(orderId) {
    const base = await discover(NAME);
    return http.post(`${base}/delivery-orders/${orderId}/prepare`, undefined, { serviceName: NAME });
  },

  // confirmPayment(in orderId, in amount, out orderStatus) — message S8b (Commit Payment).
  async confirmPayment(orderId, amount) {
    const base = await discover(NAME);
    return http.post(
      `${base}/delivery-orders/${orderId}/payment-confirmation`,
      { amount },
      { serviceName: NAME },
    );
  },

  // orderShipped(in orderId, out orderStatus) — finalizes shipment (status = Shipped).
  async orderShipped(orderId) {
    const base = await discover(NAME);
    return http.post(`${base}/delivery-orders/${orderId}/shipped`, undefined, { serviceName: NAME });
  },

  // abort(in orderId) — rollback the order (used when a use case aborts).
  async abort(orderId) {
    const base = await discover(NAME);
    return http.post(`${base}/delivery-orders/${orderId}/abort`, undefined, { serviceName: NAME });
  },
};
