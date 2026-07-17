'use strict';

const http = require('../http');
const { discover } = require('../broker/registry');

// Client for Inventory Service (Fig 22.23). Discovered under "InventoryService".
const NAME = 'InventoryService';

module.exports = {
  // checkInventory(in itemId, out inventoryStatus) — message D5.
  async checkInventory(itemId) {
    const base = await discover(NAME);
    return http.get(`${base}/inventory/${itemId}/check`, { serviceName: NAME });
  },

  // reserveInventory(in itemId, in amount) — message D11 (Prepare To Commit).
  async reserveInventory(itemId, amount) {
    const base = await discover(NAME);
    return http.post(`${base}/inventory/${itemId}/reserve`, { amount }, { serviceName: NAME });
  },

  // commitInventory(in itemId, in amount) — message S9 (Commit).
  async commitInventory(itemId, amount) {
    const base = await discover(NAME);
    return http.post(`${base}/inventory/${itemId}/commit`, { amount }, { serviceName: NAME });
  },

  // abortInventory(in itemId, in amount) — message S11 (Rollback / release).
  async abortInventory(itemId, amount) {
    const base = await discover(NAME);
    return http.post(`${base}/inventory/${itemId}/abort`, { amount }, { serviceName: NAME });
  },
};
