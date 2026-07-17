# Kịch bản thuyết trình — Coordinator (Tầng điều phối SOA, Gomaa Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design*, **Chương 22 — Service-Oriented Architecture Case Study: Online Shopping System** (tr. 424–452).
> Đây là **phần "ghép" cả hệ thống**: 3 coordinator + 2 user-interaction, nối 6 service rời rạc thành **5 use case hoàn chỉnh**. Cài đặt: **Node/Express thuần**, discover service qua **Broker**.

---

## 0. Bố cục 3 phút đầu (nói gì trước)

1. Coordinator **KHÔNG** phải service nghiệp vụ — nó là **Layer 2 (Coordination) + Layer 3 (User Interaction)** trong kiến trúc 3 lớp (Fig 22.17).
2. Nó chứa **3 coordinator** (Customer, Supplier, Billing) — mỗi coordinator điều phối một nhóm use case bằng cách gọi các service ở Layer 1.
3. Nó là **client SOA thực thụ**: tự đăng ký với Broker rồi **discover service theo tên** (Service Discovery pattern), thay vì hard-code địa chỉ.
4. Đây là nơi hiện thực **Two-Phase Commit** (use case Confirm Shipment) — điểm khó nhất của cả hệ.

> Câu chốt mở màn: *"Các bạn khác trình bày từng service đơn lẻ. Phần của em là **bộ não điều phối** — nó biến 6 service độc lập thành một hệ Online Shopping chạy được đúng 5 use case của sách."*

---

## 1. Vị trí trong kiến trúc — Layer 2 & 3 (§22.7.2, Fig 22.17)

Sách thiết kế hệ theo **Layers of Abstraction pattern**, 3 lớp:

```
Layer 3 — User Layer          : Customer Interaction · Supplier Interaction        ← Coordinator (routes)
Layer 2 — Coordination Layer  : Customer / Supplier / Billing Coordinator          ← Coordinator (logic)
Layer 1 — Service Layer        : Catalog · CustomerAccount · DeliveryOrder ·
                                 Inventory · CreditCard · Email                     ← các service khác
```

Nguyên tắc: **lớp trên phụ thuộc lớp dưới, không ngược lại** (§22.7.2). Cụ thể (§22.7.3):

- **User interaction** chỉ nói chuyện với **coordinator**.
- **Coordinator** nói chuyện với các **service**.

> Sách (tr. 442): *"User interaction components at the user interaction layer communicate only with coordinator components. Coordinator components communicate with services."*

Service này gói **cả Layer 2 và Layer 3** trong 1 process Node cho gọn (dễ demo), nhưng phân tách rõ trong mã: `src/interaction/` = Layer 3, `src/coordinators/` = Layer 2.

---

## 2. Coordinator là gì trong SOA (§22.4, §22.7.6)

Sách nói rõ vì sao cần coordinator (tr. 433):

> *"to coordinate and sequence the customer and supplier access to the online shopping services, two coordinator objects, **Customer Coordinator** and **Supplier Coordinator**, are provided. A third autonomous coordinator, **Billing Coordinator**, is needed to deal with billing customers."*

| Coordinator | Điều phối service nào | Use case |
|---|---|---|
| **Customer Coordinator** | Catalog, CustomerAccount, CreditCard, DeliveryOrder, Email | Browse Catalog, Make Order, View Order |
| **Supplier Coordinator** | DeliveryOrder, Inventory (+ Billing Coordinator) | Process Delivery Order, Confirm Shipment |
| **Billing Coordinator** | DeliveryOrder, CreditCard, Email | 2PC billing khi giao hàng |

> Điểm "theo sách" đắt giá: coordinator có **cả required lẫn provided interface** — nó là *client* của service (required) nhưng là *server* của user interaction (provided) (§22.7.6, Fig 22.27–22.29). Đúng bản chất "trung gian".

---

## 3. Discovery qua Broker — SOA thực thụ (§22.7.1, §22.7.3) — TRỌNG TÂM

Sách (tr. 440): *"services register their service name and location with a broker. Clients can then discover new services by using the **Service Discovery** pattern… to query the broker."*

**Coordinator làm đúng 2 việc với Broker:**

1. **Tự đăng ký** (Service Registration): `broker/registry.js` → `register()` POST lên `/registry/services`, rồi heartbeat mỗi 30s; thấy 404 thì tự đăng ký lại.
2. **Discover service theo tên** (white pages): trước mỗi lời gọi, client hỏi Broker `GET /registry/services/{serviceName}` để lấy `baseUrl`.

```js
// broker/registry.js — discover()
const instances = await http.get(`${BROKER_URL}/registry/services/${serviceName}`);
baseUrl = instances[0].baseUrl;           // lấy từ Broker
// ...nếu Broker down / service chưa đăng ký:
baseUrl = config.SERVICES[serviceName];   // fallback URL cấu hình
```

> **Câu chốt về binding động (§22.7.6):** *"the binding between the service provider and the service requester is **dynamic**."* → Coordinator không biết trước service ở đâu; nó hỏi Broker lúc chạy. Nhờ vậy service có thể đổi cổng/máy mà coordinator không cần sửa.

**Fallback là gì và vì sao có:** các service chính đã tự đăng ký Broker, nhưng fallback (URL trong `config.js`) vẫn giúp demo **vẫn chạy** khi Broker tạm down hoặc service chưa kịp đăng ký. Trên UI, mỗi service hiện rõ được resolve qua `broker` hay `fallback` — minh bạch.

---

## 4. Năm use case — ánh xạ chính xác message (§22.5) — TRỌNG TÂM

Đây là phần "đọc communication diagram" đắt nhất. Mỗi endpoint tương ứng một chuỗi message của sách.

### 4.1 Browse Catalog (Fig 22.12, B1–B12) — Customer Coordinator
```
GET /customer/catalog?type=Books   → customer.browseCatalog()
   B3: Customer Coordinator → CatalogService.requestCatalog
   B4: CatalogService → trả catalog info
GET /customer/catalog/item/:id      → customer.selectItem()   (B9→B10)
```

### 4.2 Make Order Request (Fig 22.13, M1–M10) — Customer Coordinator
```
POST /customer/orders {accountId, supplierId, items}
   M3/M4: → CustomerAccountService.requestAccount        (lấy tài khoản + thẻ)
   M7   : → DeliveryOrderService.store                   (tạo đơn, lấy orderId)
   M5/M6: → CreditCardService.authorizeCharge            (authorize thẻ = Prepare To Commit)
   M9a  : → EmailService.sendEmail                       (email xác nhận)
   M9/M10: trả order confirmation cho khách
```
> **Luồng thay thế A1 (thẻ bị từ chối):** `authorizeCharge` trả **402** → coordinator **abort đơn** (`DeliveryOrder.abort`) rồi trả lỗi. *(Sách §22.5.2: "if authorization… is denied… the customer can enter a different card or cancel.")*
>
> **Lưu ý thứ tự:** sách để authorize (M5) trước store (M7); em **store trước** để có `orderId` gắn cho authorization (keyed by orderId cho idempotent), rồi authorize — kết quả nghiệp vụ tương đương, và nếu authorize fail thì rollback đơn ngay.

### 4.3 Process Delivery Order (Fig 22.14, D1–D14) — Supplier Coordinator
```
GET  /supplier/orders/next?supplierId=1     → supplier.processNextOrder()
   D3/D4: → DeliveryOrderService.select      (lấy đơn kế tiếp)
   D5/D6: → InventoryService.checkInventory  (mỗi item)
POST /supplier/orders/:id/reserve           → supplier.reserveOrder()
   D11 : → InventoryService.reserveInventory (Prepare To Commit tồn kho)
   D12 : items reserved; hết hàng → rollback các reserve đã làm
```

### 4.4 Confirm Shipment & Bill Customer (Fig 22.15, S1–S12) — Supplier + Billing
```
POST /supplier/orders/:id/confirm-shipment  → supplier.confirmShipment()
   S3 : Supplier Coordinator → Billing Coordinator.orderReadyForShipment  (2PC — xem §5)
   S9 : → InventoryService.commitInventory   (mỗi item, sau khi billing xong)
   S11/S12: trả confirmation cho supplier + đánh dấu Shipped
```

### 4.5 View Order (Fig 22.16, V1–V6) — Customer Coordinator
```
GET /customer/orders/:id  → customer.viewOrder()
   V3/V4: → DeliveryOrderService.read + requestInvoice
```

---

## 5. Two-Phase Commit — điểm khó nhất (§22.7.3, Fig 22.15) — TRỌNG TÂM

Sách liệt kê 2PC là **Architectural Communication Pattern**:

> *"**Two-Phase Commit.** This pattern is used to ensure that updates to inventory, credit card, and delivery order are **atomic**, so either all updates are committed or all are aborted."*

`billing.coordinator.js` → `orderReadyForShipment(orderId)`:

```
── Phase 1: PREPARE (gom phiếu vote) ──
  S4 : DeliveryOrder.prepareToCommitOrder     (đơn vote: sẵn sàng)
  S5 : DeliveryOrder.requestInvoice           (lấy hoá đơn)
  S6/S7: CreditCard.getCharge                 (authorization còn AUTHORIZED? = vote thẻ)
  → bất kỳ bước nào fail  ⇒  rollback (abortCharge + DeliveryOrder.abort), trả 409

── Phase 2: COMMIT (mọi bên vote yes) ──
  S8a: CreditCard.commitCharge                (trừ tiền thẻ thật)
  S8b: DeliveryOrder.confirmPayment           (ghi nhận thanh toán)
  S8c: Email.sendEmail                        (best-effort)
  → rồi Supplier Coordinator: S9 Inventory.commitInventory
```

**Câu chuyện phải kể:**
> "Khi supplier xác nhận giao, ta **chưa trừ tiền/kho ngay**. Billing Coordinator **hỏi phiếu vote** từng bên (prepare). Chỉ khi **tất cả** đồng ý mới sang phase 2 **commit thật**. Nếu một bên từ chối → **abort toàn bộ**, hệ về nguyên trạng. Nhờ tách prepare/commit, hủy giao dịch rất sạch."

Ba tính chất then chốt đã cài:
- **Idempotent theo orderId**: `commitCharge`/`confirmPayment`/`commitInventory` gọi lại lần 2 không trừ 2 lần → an toàn khi retry sau sự cố giữa chừng.
- **Rollback tự động** khi prepare fail.
- **Inventory được reserve từ trước** (ở use case Process Delivery Order) → lúc commit chỉ việc chốt.

---

## 6. Vài điểm kỹ thuật đáng khoe

| Điểm | Nơi trong code | Ý nghĩa |
|---|---|---|
| Discovery + cache TTL + fallback | `broker/registry.js` | binding động, vẫn chạy khi Broker down |
| Client HTTP đồng bộ có timeout | `http.js` | **Synchronous Message w/ Reply** (§22.7.3) |
| Phân tách lỗi 4xx/5xx/503 | `errors.js` + `server.js` | 4xx = service vote abort, 503 = service chết |
| Rollback đơn khi authorize fail | `customer.coordinator.js` | luồng thay thế A1 (§22.5.2) |
| 2PC prepare/commit/abort | `billing.coordinator.js` | atomic (§22.7.3) |
| Reserve rollback khi hết hàng | `supplier.coordinator.js` | luồng thay thế "out of stock" (§22.5.3) |

> Không thêm thư viện nặng: dùng **global `fetch`** của Node ≥18, chỉ 1 dependency là `express`.

---

## 7. Ánh xạ Sách → Code (slide tổng kết)

| Khái niệm trong sách (Ch 22) | Nơi trong code |
|---|---|
| Layer 3 — Customer/Supplier Interaction | `src/interaction/*.routes.js` |
| Layer 2 — Customer Coordinator | `src/coordinators/customer.coordinator.js` |
| Layer 2 — Supplier Coordinator | `src/coordinators/supplier.coordinator.js` |
| Layer 2 — Billing Coordinator (2PC) | `src/coordinators/billing.coordinator.js` |
| Service Registration + Discovery | `src/broker/registry.js` |
| Required interface tới mỗi service | `src/clients/*.client.js` |
| Synchronous Message w/ Reply | `src/http.js` |

---

## 8. DEMO trực tiếp

**Cách 1 — UI (khuyên dùng khi thuyết trình):**
```bash
cd Coordinator && npm install && npm start   # http://localhost:3010
```
Mở `http://localhost:3010` → console 2 cột Customer/Supplier + **SOA Message Log**. Bấm lần lượt:
Browse → Make Order → Get Next Order → Reserve → Confirm Shipment → View Order. Mỗi nút hiện **use case + message number + phản hồi thật**. Thanh trên cùng hiện service nào sống & resolve qua broker/fallback.

**Cách 2 — curl (file `requests.http`):**
```bash
curl "http://localhost:3010/customer/catalog?type=Books"
curl -X POST http://localhost:3010/customer/orders -H "Content-Type: application/json" \
  -d '{"accountId":1,"supplierId":1,"items":[{"itemId":1001,"quantity":1,"unitCost":39.99}]}'
curl "http://localhost:3010/supplier/orders/next?supplierId=1"
curl -X POST http://localhost:3010/supplier/orders/1/reserve
curl -X POST http://localhost:3010/supplier/orders/1/confirm-shipment
curl "http://localhost:3010/customer/orders/1"
```

**Demo luồng thất bại (ăn điểm):**
- Thẻ bị từ chối: đặt item giá cực lớn hoặc `cardId` chứa "DECLINE" → Make Order trả **402**, đơn bị abort.
- Service chết: tắt DeliveryOrderService → mọi use case liên quan trả **503** rõ ràng, phần còn lại vẫn chạy.

> Thứ tự bật service đầy đủ: Broker(8080) → Catalog(3000)+DeliveryOrder(3001) → Inventory(3004) → CustomerAccount(8081) → CreditCard(3006) → Email(3005) → Coordinator(3010).

---

## 9. Câu hỏi có thể bị hỏi (chuẩn bị sẵn)

| Câu hỏi | Trả lời (bám sách) |
|---|---|
| Coordinator khác service ở chỗ nào? | Service ở Layer 1 chỉ cung cấp *provided* interface, thụ động. Coordinator ở Layer 2 có **cả required lẫn provided** interface — nó **điều phối/tuần tự** lời gọi tới nhiều service (§22.7.6). |
| Vì sao cần tới 3 coordinator? | Sách tách theo tác nhân/nghiệp vụ: Customer (đặt hàng), Supplier (xử lý đơn), Billing (thanh toán khi giao) — tr. 433. Billing là "autonomous coordinator" cho 2PC. |
| Discovery hoạt động sao? | Coordinator hỏi Broker `GET /registry/services/{name}` lấy `baseUrl` lúc chạy (white pages, §22.7.1). Binding động (§22.7.6). Có fallback nếu Broker/đăng ký thiếu. |
| Two-phase commit ở đâu? | Billing Coordinator: prepare (S4/S5, verify authorization) → commit (S8a charge, S8b payment) hoặc abort toàn bộ. Đảm bảo cập nhật thẻ + đơn **atomic** (§22.7.3). |
| Nếu commit giữa chừng bị lỗi? | Các thao tác **idempotent theo orderId** → gọi lại an toàn, không trừ tiền/kho 2 lần. |
| Credit Card có phải service riêng không? | Có — `CreditCardService` (Fig 22.24) độc lập; coordinator lấy `cardId` từ CustomerAccount (M3/M4) rồi authorize/commit/abort trên CreditCardService. |
| Vì sao gộp Layer 2 & 3 trong 1 process? | Chỉ để tiện demo. Mã vẫn tách `interaction/` (L3) và `coordinators/` (L2); có thể tách process sau mà không đổi logic. |

---

## 10. Câu kết mạnh

> "Đúng như Gomaa Chương 22, phần của em là **tầng điều phối** của SOA: 3 coordinator ở Layer 2 và 2 user-interaction ở Layer 3, **discover service qua Broker** (binding động), tuần tự hoá đúng **5 use case** theo communication diagram, và bảo đảm thanh toán khi giao hàng bằng **two-phase commit** atomic, idempotent. Đây là mảnh ghép biến 6 service rời rạc thành một hệ Online Shopping hoàn chỉnh."

---

## Phụ lục — Bản đồ mã nguồn (khi bị hỏi vào code)

- **Discovery + đăng ký Broker** → `src/broker/registry.js` (`discover` ~34, `register` ~90, `heartbeat` ~110)
- **Customer Coordinator** → `src/coordinators/customer.coordinator.js` (browseCatalog, makeOrder, viewOrder)
- **Supplier Coordinator** → `src/coordinators/supplier.coordinator.js` (processNextOrder, reserveOrder, confirmShipment)
- **Billing 2PC** → `src/coordinators/billing.coordinator.js` (`orderReadyForShipment`, `rollback`)
- **Client tới service** → `src/clients/{catalog,account,creditCard,deliveryOrder,inventory,email}.client.js`
- **Layer 3 routes** → `src/interaction/{customer,supplier}.routes.js`
- **HTTP + lỗi** → `src/http.js`, `src/errors.js`
- **UI demo** → `public/index.html`, endpoint `/status` → `src/status.js`
