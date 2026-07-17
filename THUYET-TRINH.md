# Thuyết trình TỔNG — Online Shopping System (SOA, Gomaa Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design: UML, Use Cases, Patterns, and Software Architectures*, **Chương 22 — Service-Oriented Architecture Case Study: Online Shopping System** (tr. 424–452).
> Đây là **bản đồ tổng** của cả hệ. Mỗi service có file `THUYET-TRINH.md` riêng trong thư mục của nó để đi sâu.

---

## 1. Hệ thống chạy trên port nào?

| # | Thành phần | Layer (Fig 22.17) | Stack | Port | Đăng ký Broker? | File chi tiết |
|---|---|---|---|---|---|---|
| 0 | **Broker** | Hạ tầng SOA | Java / Spring Boot | **8080** | (là registry) | `Broker/THUYET-TRINH.md` |
| 1 | **CatalogService** | L1 Service | NestJS + MongoDB | **3000** | ❌ (dùng fallback) | `CatalogService/THUYET-TRINH.md` |
| 2 | **DeliveryOrderService** | L1 Service | NestJS + MongoDB | **3001** | ❌ (dùng fallback) | `DeliveryOrderService/THUYET-TRINH.md` |
| 3 | **InventoryService** | L1 Service | Node/Express + SQLite | **3004** | ✅ | `InventoryService/THUYET-TRINH.md` |
| 4 | **CustomerAccountService** | L1 Service | Java / Spring + H2 | **8081** | ✅ | `CustomerAccountService/THUYET-TRINH.md` |
| 5 | **CreditCardService** | L1 Service (external) | Node/Express | **3006** | ✅ | `CreditCardService/THUYET-TRINH.md` |
| 6 | **EmailService** | L1 Service (external) | Node/Express | **3005** | ✅ | `EmailService/THUYET-TRINH.md` |
| 7 | **Coordinator** | L2 Coordination + L3 User | Node/Express | **3010** | ✅ | `Coordinator/THUYET-TRINH.md` |

> **Thứ tự khởi động để demo đủ:** Broker(8080) → Catalog(3000) + DeliveryOrder(3001) *(cần MongoDB)* → Inventory(3004) → CustomerAccount(8081) → CreditCard(3006) → Email(3005) → **Coordinator(3010)**. Mở UI: **http://localhost:3010**.
>
> Thiếu service nào thì use case liên quan trả **503**, phần còn lại vẫn chạy. Đây là tính **loose coupling** của SOA.

---

## 2. Code bám thiết kế trong sách như thế nào?

### 2.1 Kiến trúc phân lớp — Layers of Abstraction (§22.7.2, Fig 22.17)

Sách thiết kế hệ thành **3 lớp**, lớp trên chỉ phụ thuộc lớp dưới:

```
Layer 3 — User Layer          Customer Interaction        Supplier Interaction
                                       │                          │              ┐
Layer 2 — Coordination Layer   Customer Coord.   Supplier Coord. ── Billing Coord. ├─ Coordinator/  (1 process)
                                       │                 │                 │       ┘
Layer 1 — Service Layer         Catalog  CustomerAccount  DeliveryOrder  Inventory  CreditCard  Email
                                (3000)     (8081)           (3001)        (3004)     (3006)      (3005)
                                                    ▲
                                       Broker (8080) — service registration / discovery
```

**Ánh xạ code:** Layer 1 = 6 service độc lập (mỗi thư mục 1 service). Layer 2 & 3 = thư mục `Coordinator/` (`coordinators/` = L2, `interaction/` = L3). Broker = registry độc lập.

> Sách (tr. 442): *"User interaction components … communicate only with coordinator components. Coordinator components communicate with services."* — Code tuân đúng: UI routes chỉ gọi coordinator; coordinator gọi service qua client.

### 2.2 Sáu service = sáu service class của sách (§22.4, Fig 22.10–22.11)

Sách: 4 application service (Catalog, CustomerAccount, DeliveryOrder, Inventory) + 2 external service (CreditCard, Email). **Nhóm hiện thực đủ cả 6**, mỗi service **một provided interface** đúng Fig 22.20–22.24:

| Service | Interface (sách) | Thao tác chính |
|---|---|---|
| Catalog | `ICatalogService` (Fig 22.20) | requestCatalog, requestSelection |
| CustomerAccount | `ICustomerAccountService` (Fig 22.21) | requestAccount, createAccount, updateAccount (+ hold) |
| DeliveryOrder | `IDeliveryOrderService` (Fig 22.22) | store, select, prepare, confirmPayment, commit, abort, read, requestInvoice |
| Inventory | `IInventoryService` (Fig 22.23) | checkInventory, reserveInventory, commitInventory, abortInventory, update |
| CreditCard | `ICreditCardService` (Fig 22.24) | authorizeCharge, commitCharge, abortCharge |
| Email | `IEmailService` (Fig 22.24) | sendEmail |

> Mỗi service dùng **stack khác nhau** (Java, NestJS, Node) nhưng cùng tuân interface + discover qua Broker → đúng tinh thần **binding động** của SOA (§22.7.6): *"the binding between the service provider and the service requester is dynamic."*

### 2.3 Broker — Registration & Discovery (§22.7.1, §22.7.3)

- **Service Registration:** mỗi service POST `/registry/services` lúc khởi động, heartbeat định kỳ, 404 → tự đăng ký lại.
- **Service Discovery:** Coordinator hỏi Broker `GET /registry/services/{name}` (white pages) hoặc `?operation=` (yellow pages) để lấy địa chỉ service lúc chạy.

> Sách (tr. 424): *"object brokers are used to provide service registration, brokering, and discovery."*

### 2.4 Bốn communication pattern của sách (§22.7.3) — đều có trong code

| Pattern (sách) | Ở đâu trong hệ |
|---|---|
| **Synchronous Message w/ Reply** | Mọi lời gọi coordinator → service (`Coordinator/src/http.js`) |
| **Broker Handle / Service Discovery** | `Coordinator/src/broker/registry.js` + Broker |
| **Bidirectional Async** (Supplier ↔ Billing) | Supplier Coordinator gọi Billing Coordinator (S3) rồi nhận kết quả |
| **Two-Phase Commit** | `Coordinator/src/coordinators/billing.coordinator.js` |

### 2.5 Năm use case = năm communication diagram (§22.5)

| Use case | Diagram | Coordinator điều phối | Chuỗi message |
|---|---|---|---|
| Browse Catalog | Fig 22.12 | Customer | B3/B4, B9/B10 |
| Make Order Request | Fig 22.13 | Customer | M3/M4 → M7 → **M5/M6** → M9a |
| Process Delivery Order | Fig 22.14 | Supplier | D3/D4 → D5/D6 → **D11/D12** |
| Confirm Shipment & Bill | Fig 22.15 | Supplier + Billing | S3 → **2PC (S4–S8)** → S9/S10 → S11/S12 |
| View Order | Fig 22.16 | Customer | V3/V4 |

### 2.6 Two-Phase Commit — điểm nhấn cả hệ (§22.7.3, Fig 22.15)

Khi giao hàng, cập nhật **CreditCard + DeliveryOrder + Inventory** phải **atomic**:

```
Phase 1 PREPARE : DeliveryOrder.prepare(S4) · invoice(S5) · CreditCard vote(S6/S7) · Inventory đã reserve(D11)
                  → bất kỳ ai vote abort ⇒ rollback tất cả (abortCharge + order.abort + release reserve)
Phase 2 COMMIT  : CreditCard.commitCharge(S8a) · DeliveryOrder.confirmPayment(S8b) · Email(S8c) · Inventory.commit(S9)
```
Ba participant là **thụ động, idempotent theo orderId**; Billing/Supplier Coordinator là **bên điều phối**.

> Sách: *"either all updates are committed or all are aborted."*

---

## 3. Luồng end-to-end một đơn hàng (kể chuyện khi demo)

```
Khách  ──Browse──▶  Catalog                                   (B: xem hàng)
Khách  ──Make Order─▶ Customer Coord. ─▶ Account(M3/M4)
                                       ─▶ DeliveryOrder.store(M7)
                                       ─▶ CreditCard.authorize(M5/M6)   ← thẻ bị từ chối thì huỷ đơn (A1)
                                       ─▶ Email(M9a)
Supplier ─Process──▶ Supplier Coord. ─▶ DeliveryOrder.select(D3/D4)
                                      ─▶ Inventory.check(D5/D6)
Supplier ─Reserve──▶ Supplier Coord. ─▶ Inventory.reserve(D11/D12)      ← hết hàng thì rollback
Supplier ─Confirm──▶ Supplier Coord. ─▶ Billing Coord. [2PC]:
                                          prepare order + verify charge → commitCharge + confirmPayment + email
                                      ─▶ Inventory.commit(S9) ─▶ đơn Shipped(S11/S12)
Khách  ──View─────▶  Customer Coord. ─▶ DeliveryOrder.read(V3/V4)
```

---

## 4. Trạng thái hoàn thành

| Hạng mục | Trạng thái |
|---|---|
| 6 service + Broker + Coordinator | ✅ đủ, chạy được |
| 5 use case nối thông qua coordinator | ✅ |
| Discovery qua Broker + fallback | ✅ verify chạy thật |
| Two-Phase Commit (prepare/commit/abort, idempotent) | ✅ |
| Luồng thất bại: thẻ từ chối (402), hết hàng (409), service chết (503) | ✅ |
| UI demo (`http://localhost:3010`) | ✅ |

**Điểm cần nói thật (lựa chọn thiết kế, không phải thiếu):**
- Catalog & DeliveryOrder (NestJS) **chưa tự đăng ký Broker** → Coordinator discover chúng qua **fallback URL** (vẫn đúng SOA, chỉ là chưa registration).
- CustomerAccount có sẵn cơ chế **hold** (cũng có thể đóng vai credit card); nhưng luồng dùng **CreditCardService** chuyên trách cho đúng Fig 22.24.
- Luồng "chưa có tài khoản → tạo mới" (M2 alt) chưa đưa vào coordinator.
- End-to-end với **cả 8 process chạy đồng thời** cần MongoDB + Java; hiện đã verify plumbing, discovery và từng nhánh lỗi.

---

## 5. Ai trình bày phần nào (gợi ý chia nhóm)

| Người | Service | Điểm nhấn |
|---|---|---|
| — | **Broker** | registration/discovery, white/yellow pages, TTL sweep |
| — | **Catalog** | Browse Catalog (B3/B9), NestJS + Mongo |
| — | **CustomerAccount** | account + hold, tham gia 2PC, tự đăng ký Broker |
| — | **DeliveryOrder** | 4 use case, prepare/commit/abort đơn |
| — | **Inventory** | 2PC participant, SQL atomic chống race |
| — | **CreditCard + Email** | 2 external service, authorize/charge + sendEmail |
| — | **Coordinator** | 3 coordinator, 5 use case, discovery, **Two-Phase Commit** |

---

## 6. Câu kết cả nhóm

> "Nhóm em hiện thực đầy đủ **kiến trúc SOA 3 lớp** của Gomaa Chương 22: **6 service** (mỗi service một provided interface đúng Fig 22.20–22.24, đa dạng stack), một **Broker** cho registration/discovery, và một **tầng điều phối** gồm 3 coordinator tuần tự hoá **5 use case** — có **two-phase commit** đảm bảo thanh toán khi giao hàng là atomic. Các service ghép với nhau qua **binding động**, đúng tinh thần service-oriented architecture."
