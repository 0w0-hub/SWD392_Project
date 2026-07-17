'use strict';

const http = require('../http');
const { discover } = require('../broker/registry');

// Client for Customer Account Service (Fig 22.21). Discovered under
// "CustomerAccountService". The Credit Card Service of the book is realized here
// via the account's HOLD lifecycle: placeHold = authorize, captureHold = commit
// charge, releaseHold = abort charge.
const NAME = 'CustomerAccountService';

module.exports = {
  // requestAccount(in accountId, out account) — messages M3 / S6.
  async requestAccount(accountId) {
    const base = await discover(NAME);
    return http.get(`${base}/api/v1/accounts/${accountId}`, { serviceName: NAME });
  },

  // authorizeCharge — place a hold on the account for an order (message M5,
  // Prepare To Commit for payment). Idempotent by orderId on the service side.
  async placeHold(accountId, orderId, amount, description) {
    const base = await discover(NAME);
    return http.post(
      `${base}/api/v1/accounts/${accountId}/holds`,
      { orderId: String(orderId), amount, description },
      { serviceName: NAME },
    );
  },

  // getHold(orderId) — used by Billing Coordinator to read the authorization vote.
  async getHold(orderId) {
    const base = await discover(NAME);
    return http.get(`${base}/api/v1/accounts/holds/${orderId}`, { serviceName: NAME });
  },

  // commitCharge — capture the hold (message S8a, Commit Charge). Idempotent.
  async captureHold(orderId) {
    const base = await discover(NAME);
    return http.post(
      `${base}/api/v1/accounts/holds/${orderId}/capture`,
      undefined,
      { serviceName: NAME },
    );
  },

  // abortCharge — release the hold (Rollback of the authorization). Idempotent.
  async releaseHold(orderId) {
    const base = await discover(NAME);
    return http.post(
      `${base}/api/v1/accounts/holds/${orderId}/release`,
      undefined,
      { serviceName: NAME },
    );
  },
};
