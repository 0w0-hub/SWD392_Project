'use strict';

const http = require('../http');
const { discover } = require('../broker/registry');

// Client for Credit Card Service (Fig 22.24). Discovered under "CreditCardService".
// This is the dedicated external credit-card participant of the two-phase commit:
//   authorizeCharge (M5) -> commitCharge (S8a) / abortCharge.
const NAME = 'CreditCardService';

module.exports = {
  // authorizeCharge(in creditcardId, in amount, out authorizationResponse) — M5.
  async authorizeCharge(cardId, orderId, amount) {
    const base = await discover(NAME);
    return http.post(
      `${base}/authorizations`,
      { cardId, orderId: String(orderId), amount },
      { serviceName: NAME },
    );
  },

  // Read the authorization (Billing Coordinator uses this as the payment vote).
  async getCharge(orderId) {
    const base = await discover(NAME);
    return http.get(`${base}/authorizations/${orderId}`, { serviceName: NAME });
  },

  // commitCharge(in creditcardId, in amount, out chargeResponse) — S8a. Idempotent.
  async commitCharge(orderId) {
    const base = await discover(NAME);
    return http.post(`${base}/authorizations/${orderId}/commit`, undefined, { serviceName: NAME });
  },

  // abortCharge(in creditcardId, in amount, out chargeResponse). Idempotent.
  async abortCharge(orderId) {
    const base = await discover(NAME);
    return http.post(`${base}/authorizations/${orderId}/abort`, undefined, { serviceName: NAME });
  },
};
