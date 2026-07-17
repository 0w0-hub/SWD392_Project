'use strict';

const http = require('../http');
const { discover } = require('../broker/registry');

// Client for Catalog Service (Fig 22.20). Discovered via the Broker under the
// name "CatalogService".
const NAME = 'CatalogService';

module.exports = {
  // requestCatalog(in catalogType, out catalogInfo) — message B3.
  async requestCatalog(catalogType) {
    const base = await discover(NAME);
    return http.get(`${base}/catalog?type=${encodeURIComponent(catalogType)}`, { serviceName: NAME });
  },

  // requestSelection(in itemId, out itemInfo) — message B9.
  async requestSelection(itemId) {
    const base = await discover(NAME);
    return http.get(`${base}/catalog/item/${itemId}`, { serviceName: NAME });
  },
};
