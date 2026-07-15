# InventoryService

Inventory Service for the **Online Shopping System** (Gomaa, *Software Modeling and Design*, Ch.22).
Standalone SOA service — **Express + SQLite (better-sqlite3)**, plain JavaScript.

Implements the `IInventoryService` interface (Fig 22.23) and acts as a **participant**
in the two-phase commit driven by the Supplier/Billing coordinators.

## Run

```bash
cd InventoryService
npm install
npm run seed     # optional: load sample items (1001, 1002, 1003)
npm start        # http://localhost:3004   (npm run dev for --watch)
```

SQLite file is created at `data/inventory.db` on first start.

## Data model (Fig 22.23)

`inventory`: `itemId`, `itemDescription`, `quantity`, `quantityReserved`, `price`, `reorderTime`
Invariant: `0 <= quantityReserved <= quantity`; available = `quantity - quantityReserved`.

`InventoryStatus` (returned by the endpoints): `itemId`, `currentAmount` (= quantity),
`quantityAfterShipped` (= quantity − quantityReserved), `reorderTime`.

## Operations & endpoints

| Operation (2PC role) | Endpoint | Effect |
|---|---|---|
| `checkInventory` (read, D5) | `GET /inventory/:itemId/check` | returns InventoryStatus |
| `reserveInventory` (prepare, D11) | `POST /inventory/:itemId/reserve` `{amount}` | `quantityReserved += amount` (409 if out of stock) |
| `commitInventory` (commit, S9) | `POST /inventory/:itemId/commit` `{amount}` | `quantity -= amount; quantityReserved -= amount` |
| `abortInventory` (rollback, S11) | `POST /inventory/:itemId/abort` `{amount}` | `quantityReserved -= amount` → *Items Released* (S12) |
| `update` (restock) | `PATCH /inventory/:itemId` `{amount}` | `quantity += amount` |

## Example — main flow (reserve → commit)

```bash
curl http://localhost:3004/inventory/1001/check
curl -X POST http://localhost:3004/inventory/1001/reserve -H "Content-Type: application/json" -d "{\"amount\":2}"
curl -X POST http://localhost:3004/inventory/1001/commit  -H "Content-Type: application/json" -d "{\"amount\":2}"
```

## Example — alternative flow: credit card denied (Fig 22.15a)

When the credit card charge is **denied** (S8b), the coordinators roll back the 2PC.
The Inventory Service's part is **S11 `abortInventory` → S12 Items Released** (releases the
reservation; `quantity` unchanged):

```bash
curl -X POST http://localhost:3004/inventory/1001/reserve -H "Content-Type: application/json" -d "{\"amount\":2}"
# ... charge denied elsewhere -> SupplierCoordinator calls:
curl -X POST http://localhost:3004/inventory/1001/abort   -H "Content-Type: application/json" -d "{\"amount\":2}"
```

See `PLAN.md` for the full design and the S1–S14 message walkthrough of the alternative flow.
