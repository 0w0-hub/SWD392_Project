# Coordinator Service — luồng SOA của Online Shopping System

Tầng **điều phối (Layer 2)** + **giao tiếp người dùng (Layer 3)** theo Gomaa, Chương 22.
Đây là phần "ghép" các service rời rạc thành 5 use case hoàn chỉnh của hệ thống.

```
Layer 3  User Interaction   Customer Interaction        Supplier Interaction
                                     │                           │
Layer 2  Coordination       Customer Coordinator   Supplier Coordinator ── Billing Coordinator
                                     │                    │                        │
Layer 1  Services            Catalog · Account · DeliveryOrder · Inventory · CreditCard · Email  (discovered via Broker)
```

Coordinator là **client SOA**: nó tự đăng ký với **Broker** và **discover** các service theo tên
(`GET /registry/services/{serviceName}`). Nếu Broker chưa chạy hoặc service chưa đăng ký, nó **fallback**
sang URL cấu hình (xem `src/config.js`) — nhờ vậy demo vẫn chạy khi chưa dựng đủ mọi thứ.

## Chạy

Cần Node ≥ 18 (dùng global `fetch`).

```bash
npm install
npm start           # http://localhost:3010  (UI demo tại "/")
```

Biến môi trường (đều có mặc định): `PORT`, `BROKER_URL`, `CATALOG_URL`, `DELIVERY_URL`,
`INVENTORY_URL`, `ACCOUNT_URL`, `CREDITCARD_URL`, `EMAIL_URL`.

### Thứ tự khởi động cho demo đầy đủ
1. **Broker** (8080) — `mvn spring-boot:run` trong `Broker/`
2. **CatalogService** (3000), **DeliveryOrderService** (3001) — cần MongoDB
3. **InventoryService** (3004) — `npm start` (đã tự đăng ký Broker)
4. **CustomerAccountService** (8081) — `mvn spring-boot:run` (profile `demo` nạp sẵn khách hàng + tài khoản)
5. **CreditCardService** (3006) — `npm start` trong `CreditCardService/`
6. **EmailService** (3005) — `npm start` trong `EmailService/`
7. **Coordinator** (3010) — `npm start`, mở http://localhost:3010

> Thiếu service nào thì use case liên quan trả **503** (service unavailable) với thông báo rõ ràng —
> phần còn lại vẫn chạy. Thanh trạng thái trên UI hiển thị service nào đang sống và được resolve qua
> **broker** hay **fallback**.

## UI demo

`http://localhost:3010/` — console 2 cột (Customer / Supplier) + **SOA Message Log**. Mỗi nút bấm hiển thị
use case, các **message number** của Gomaa (B/M/D/S/V) và phản hồi thật từ service.

## 5 use case và ánh xạ message

| Use case | Endpoint (Interaction) | Coordinator | Message |
|---|---|---|---|
| UC1 Browse Catalog | `GET /customer/catalog?type=` · `/customer/catalog/item/:id` | Customer | B3/B4, B9/B10 |
| UC2 Make Order Request | `POST /customer/orders` | Customer | M3/M4 → M7 → M5/M6 → M9a |
| UC3 Process Delivery Order | `GET /supplier/orders/next?supplierId=` | Supplier | D3/D4 → D5/D6 |
| UC3 Reserve Items | `POST /supplier/orders/:id/reserve` | Supplier | D11 → D12 (Prepare to Commit) |
| UC4 Confirm Shipment & Bill | `POST /supplier/orders/:id/confirm-shipment` | Supplier + Billing | S3 → **2PC** → S9/S10 → S11/S12 |
| UC5 View Order | `GET /customer/orders/:id` | Customer | V3/V4 |

### Two-Phase Commit (UC4)

`Billing Coordinator.orderReadyForShipment(orderId)`:

- **Phase 1 — Prepare (gom phiếu vote):** DeliveryOrder `prepare` (S4) → lấy `invoice` (S5) →
  kiểm tra `authorization` thẻ còn hiệu lực (S6/S7). Nếu bất kỳ bước nào fail → **rollback**
  (`abortCharge` + DeliveryOrder `abort`) và trả `409 TransactionAborted`.
- **Phase 2 — Commit:** `commitCharge` (S8a, trừ tiền thẻ) → `confirmPayment` (S8b) → gửi email (S8c).
  Sau đó Supplier Coordinator `commitInventory` (S9) rồi đánh dấu đơn **Shipped** (S11/S12).

**Credit Card Service** là service riêng (Fig 22.24, `CreditCardService/`): `authorizeCharge` (M5) →
`commitCharge` (S8a) → `abortCharge` — tất cả **idempotent** theo `orderId`. Card id lấy từ
`accountNumber` của CustomerAccount (đọc ở M3/M4). *(CustomerAccountService cũng có cơ chế `hold`
riêng có thể đóng vai credit — nhưng luồng ở đây dùng CreditCardService chuyên trách cho đúng sách.)*

## Cấu trúc

```
src/
  config.js                 cấu hình + URL fallback
  http.js                   client fetch JSON (Synchronous Message w/ Reply)
  status.js                 discovery + reachability cho UI
  broker/registry.js        tự đăng ký + heartbeat + discover(serviceName)
  clients/                  1 client cho mỗi service (đều discover qua Broker)
  coordinators/
    customer.coordinator.js Browse / Make Order / View Order
    supplier.coordinator.js Process Delivery Order / Reserve / Confirm Shipment
    billing.coordinator.js  Two-Phase Commit billing
  interaction/              Customer & Supplier Interaction (routes Layer 3)
  server.js                 Express app + phục vụ UI
public/index.html           UI demo
requests.http               request mẫu để bấm thử
```
