# Catalog Service

NestJS implementation of the Online Shopping System's `ICatalogService` from
`CASESTUDY.pdf` (Figure 22.20).

## Case-study coverage

- `requestCatalog(catalogType)` returns catalogs and their item information for
  one of the defined types: `Books`, `Computers`, `Home`, or `Toys`.
- `requestSelection(itemId)` returns the description, price, supplier, and detail
  URL for a selected item.
- Suppliers own catalogs and items; every catalog contains one or more items in
  the domain model.
- The service registers its two operations with the project Broker, sends
  heartbeats, re-registers after a Broker restart, and deregisters on graceful
  shutdown.
- Catalog reads remain available if the Broker is temporarily offline.

The Browse Catalog use case's itemized selection list and total price belong to
the Customer Coordinator/user-interaction layer. The Catalog Service supplies the
individual `ItemInfo` values used to build that list, matching the interface in
Figure 22.20.

## API

| Method | Endpoint | Case-study operation |
| --- | --- | --- |
| `GET` | `/catalog?type=Books` | `requestCatalog` |
| `GET` | `/catalog/item/1001` | `requestSelection` |
| `GET` | `/health` | Broker/operations health check |

Invalid catalog types and non-positive item IDs return `400`. A selected item that
does not exist returns `404`. A valid catalog type with no matching catalogs returns
an empty array.

## Data model

SQLite is used for local persistence. The database defaults to `catalog.sqlite`;
set `SQLITE_DB_PATH` to another file or to `:memory:` for an ephemeral database.
The persisted entities implement the case-study fields:

- `CatalogInfo`: `catalogId`, `catalogDescription`, `supplierId`, `catalogType`
- `ItemInfo`: `itemId`, `itemDescription`, `unitCost`, `supplierId`, `itemDetails`
- `Supplier`: `supplierId`, `supplierName`, `address`, `telephoneNumber`,
  `faxNumber`, `email`

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `SQLITE_DB_PATH` | `catalog.sqlite` | SQLite database path |
| `BROKER_ENABLED` | `true` | Set to `false` to disable registration |
| `BROKER_URL` | `http://localhost:8080` | Broker base URL |
| `BROKER_HEARTBEAT_INTERVAL_MS` | `30000` | Heartbeat/retry interval |
| `SERVICE_ID` | process-specific | Unique registry instance ID |
| `SERVICE_HOST` | `localhost` | Advertised host |
| `SERVICE_BASE_URL` | derived from host/port | Advertised public base URL |

Broker registration is automatically disabled when `NODE_ENV=test`.

## Setup and verification

```bash
pnpm install
pnpm run start:dev
```

```bash
pnpm run build
pnpm run lint
pnpm run test
pnpm run test:e2e
```
