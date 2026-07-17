'use strict';

// Central configuration for the Coordination layer (Gomaa, Fig 22.17 Layer 2).
//
// The coordinator is a service-oriented client: it discovers the services it needs
// through the Broker (Service Discovery pattern, Sec 22.7.3). Because not every
// teammate service self-registers yet, each service also has a fallback base URL so
// the flow still runs when the Broker (or that service's registration) is unavailable.

const HOST = process.env.HOST || 'localhost';

// This coordinator process — it also registers itself with the Broker.
const SELF = {
  serviceName: 'CoordinatorService',
  version: '1.0',
  host: HOST,
  port: Number(process.env.PORT || 3010),
};
SELF.baseUrl = process.env.SELF_BASE_URL || `http://${HOST}:${SELF.port}`;

// Broker (Service Registry) — Sec 22.7.3 Broker Handle.
const BROKER_URL = process.env.BROKER_URL || 'http://localhost:8080';

// Downstream services, keyed by the serviceName they register under in the Broker.
// The value is the fallback base URL used when discovery returns nothing.
const SERVICES = {
  CatalogService: process.env.CATALOG_URL || 'http://localhost:3000',
  DeliveryOrderService: process.env.DELIVERY_URL || 'http://localhost:3001',
  InventoryService: process.env.INVENTORY_URL || 'http://localhost:3004',
  CustomerAccountService: process.env.ACCOUNT_URL || 'http://localhost:8081',
  CreditCardService: process.env.CREDITCARD_URL || 'http://localhost:3006',
  EmailService: process.env.EMAIL_URL || 'http://localhost:3005',
};

// How long a discovered base URL is cached before we ask the Broker again (ms).
const DISCOVERY_TTL_MS = Number(process.env.DISCOVERY_TTL_MS || 15000);

// Heartbeat cadence for our own registration (ms). Broker TTL is 90s.
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 30000);

module.exports = {
  SELF,
  BROKER_URL,
  SERVICES,
  DISCOVERY_TTL_MS,
  HEARTBEAT_INTERVAL_MS,
};
