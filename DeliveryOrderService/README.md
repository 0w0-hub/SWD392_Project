# DeliveryOrderService

NestJS + SQLite implementation of the Delivery Order Service from the Online
Shopping System service-oriented architecture case study.

## Main operations

- `POST /delivery-orders` - store an order and return `orderId`.
- `GET /delivery-orders/supplier/:supplierId/next` - select the next unshipped
  order for a supplier.
- `PATCH /delivery-orders/:orderId` - update an order and return `orderStatus`.
- `POST /delivery-orders/:orderId/shipped` - mark an order shipped.
- `POST /delivery-orders/:orderId/payment-confirmation` - confirm payment amount.
- `GET /delivery-orders/:orderId` - read an order.
- `GET /delivery-orders/:orderId/invoice` - request invoice data extracted from
  the order.
- `POST /delivery-orders/:orderId/prepare` - prepare the order for two-phase
  commit.
- `POST /delivery-orders/:orderId/commit` - commit the order as shipped.
- `POST /delivery-orders/:orderId/abort` - abort the prepared order.

## Run

```bash
pnpm install
pnpm run start:dev
```

The service listens on `PORT` or `3001` by default and uses SQLite at
`data/delivery-order.db`. Set `DELIVERY_ORDER_DB` to override the database file.

## Broker registration

- Registers as `DeliveryOrderService` with the project Broker.
- Exposes `GET /health` for Broker health checks.
- Sends heartbeats, re-registers after Broker restart, and deregisters on
  graceful shutdown.
- Registration is skipped when `BROKER_ENABLED=false` or `NODE_ENV=test`.

| Variable | Default | Purpose |
|---|---:|---|
| `BROKER_URL` | `http://localhost:8080` | Broker base URL |
| `BROKER_HEARTBEAT_INTERVAL_MS` | `30000` | Heartbeat/retry interval |
| `SERVICE_ID` | process-specific | Unique registry instance ID |
| `SERVICE_HOST` | `localhost` | Host advertised to Broker |
| `SERVICE_BASE_URL` | `http://localhost:PORT` | Base URL advertised to Broker |
