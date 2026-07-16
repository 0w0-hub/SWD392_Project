# InventoryService — Implementation Plan

> Theo Gomaa, *Software Modeling and Design*, Chương 22 — Online Shopping System (SOA case study).
> Tài liệu này **chỉ là plan để duyệt** — chưa có code. Sau khi bạn OK sẽ code theo đúng đây.

**Stack đã chốt:** Express + **JavaScript thuần** + **better-sqlite3** (raw SQL, không ORM).
Service **độc lập**, không dùng NestJS/Mongoose như CatalogService — SOA cho phép mỗi service implement khác nhau miễn tuân thủ đúng interface `IInventoryService` (sách §22.7.6).

Tham chiếu hình trong sách:
- **Fig 22.10 / 22.11 / 22.17** — InventoryService thuộc Service Layer, dùng entity `Inventory`.
- **Fig 22.14** — Process Delivery Order: `checkInventory` (D5), `reserveInventory` (D11 = *prepare to commit*).
- **Fig 22.15** — Confirm Shipment and Bill Customer: `commitInventory` (S9 = *commit*).
- **Fig 22.15a** — Alternative flow (credit card denied): `abortInventory` (S11 = *rollback*). ← ảnh bạn gửi.
- **Fig 22.23** — Service interface `IInventoryService` + entity `Inventory` + `InventoryStatus`.

---

## 1. Bối cảnh & phạm vi

InventoryService là **1 service độc lập** trong SOA. Nó **không** tự điều phối giao dịch — nó chỉ là *participant* trong two-phase commit (2PC) do **SupplierCoordinator** / **BillingCoordinator** điều khiển (Ch.16).

**Trong repo này chỉ code InventoryService.** Các thành phần khác (SupplierCoordinator, BillingCoordinator, DeliveryOrderService, CreditCardService…) nằm ở service/repo riêng — ở đây chỉ mô tả *contract* để biết ai gọi hàm nào, không code.

Runtime: **Node.js + Express**, DB file **SQLite** (`inventory.db`), port `3004` (Catalog đang 3000).
Vì sao SQLite hợp 2PC: các `UPDATE ... WHERE (quantity - quantityReserved) >= ?` có điều kiện, chạy trong transaction đồng bộ của better-sqlite3 → atomic sạch, chống race giữa nhiều đơn.

---

## 2. Cấu trúc thư mục

```
InventoryService/
├── package.json                # express, better-sqlite3; scripts: start / dev (--watch)
├── .gitignore                  # node_modules, *.db
├── README.md
├── data/
│   └── inventory.db            # file SQLite (tạo tự động lúc khởi động)
└── src/
    ├── server.js               # bootstrap Express, mount routes, listen PORT ?? 3004
    ├── db.js                   # mở better-sqlite3, tạo bảng nếu chưa có (schema init)
    ├── seed.js                 # (tùy chọn) nạp vài item mẫu để test nhanh
    └── inventory/
        ├── inventory.routes.js       # định nghĩa Express router (controller layer)
        ├── inventory.service.js      # logic 2PC — trọng tâm (implements IInventoryService)
        ├── inventory.repository.js   # raw SQL với better-sqlite3 (data access)
        └── inventory.status.js       # hằng InventoryStatusType: Available / LowStock / OutOfStock
```

Phân lớp: **routes (HTTP) → service (nghiệp vụ/2PC) → repository (SQL)** — tương ứng controller/service/data-access, giữ logic tách bạch giống tinh thần CatalogService.

---

## 3. Data model (bám sát Fig 22.23)

### 3.1. Bảng `inventory` (SQLite)

| Cột | Kiểu SQLite | Ý nghĩa |
|---|---|---|
| `itemId` | INTEGER PRIMARY KEY | khóa |
| `itemDescription` | TEXT NOT NULL | mô tả |
| `quantity` | INTEGER NOT NULL DEFAULT 0 | **tổng tồn kho vật lý** đang có |
| `quantityReserved` | INTEGER NOT NULL DEFAULT 0 | số đã **giữ chỗ** cho delivery order nhưng **chưa xuất** |
| `price` | REAL NOT NULL | đơn giá |
| `reorderTime` | TEXT | mốc cần nhập lại (ISO date string) |

Ràng buộc bất biến (enforce bằng `CHECK` + điều kiện WHERE):
```sql
CHECK (quantityReserved >= 0)
CHECK (quantityReserved <= quantity)
```
> **Bất biến quan trọng:** `Available = quantity - quantityReserved` (số có thể nhận đơn mới).

### 3.2. `InventoryStatus` (Fig 22.23 — object trả về, **không** lưu bảng)

| Field | Công thức |
|---|---|
| `itemId` | itemId |
| `currentAmount` | `quantity - quantityReserved` (đang sẵn để giữ chỗ) |
| `quantityAfterShipped` | `quantity - quantityReserved` (tồn còn lại sau khi hàng đã-reserve xuất đi) |
| `reorderTime` | reorderTime |
| `status` | `InventoryStatusType` *(mở rộng nhỏ; sách chỉ có 4 field số — xem Mục 8)* |

---

## 4. Service operations — `IInventoryService` (Fig 22.23) + ngữ nghĩa 2PC

Cốt lõi. 5 operation, ánh xạ trực tiếp vào các pha two-phase commit. Mỗi thao tác ghi bọc trong `db.transaction(...)`:

| Operation | Vai trò 2PC | SQL (rút gọn) | Ném lỗi khi |
|---|---|---|---|
| `checkInventory(itemId)` → `InventoryStatus` | đọc (D5) | `SELECT ... WHERE itemId=?` | không tồn tại → 404 |
| `reserveInventory(itemId, amount)` | **PREPARE** (D11) — vote | `UPDATE inventory SET quantityReserved = quantityReserved + ? WHERE itemId=? AND (quantity - quantityReserved) >= ?` | `changes === 0` → thiếu hàng → 409 (*vote abort / out of stock*) |
| `commitInventory(itemId, amount)` | **COMMIT** (S9) | `UPDATE inventory SET quantity = quantity - ?, quantityReserved = quantityReserved - ? WHERE itemId=? AND quantityReserved >= ?` | `changes === 0` → 409 |
| `abortInventory(itemId, amount)` | **ROLLBACK** (S11) | `UPDATE inventory SET quantityReserved = MAX(0, quantityReserved - ?) WHERE itemId=?` → *"Items Released"* | không tồn tại → 404 |
| `update(itemId, amount)` | ngoài giao dịch — nhập kho | `UPDATE inventory SET quantity = quantity + ? WHERE itemId=?` | không tồn tại → 404 |

**Ghi chú thiết kế:**
- `reserveInventory` = *prepare*: chỉ **giữ chỗ** (`quantityReserved += amount`), chưa trừ tồn thật → rollback sạch.
- `commitInventory` mới trừ tồn thật (`quantity`) và bỏ giữ chỗ.
- `abortInventory` chỉ **nhả giữ chỗ**, `quantity` không đổi → đúng nghĩa "Items Released" (S12).
- **Atomic chống race:** điều kiện nằm ngay trong mệnh đề `WHERE` + transaction → không cần đọc-rồi-ghi (không có khoảng hở race). Kiểm tra `result.changes` để biết thành/bại.

---

## 5. REST endpoints (Express router)

| Method | Route | → Service |
|---|---|---|
| `GET` | `/inventory/:itemId/check` | `checkInventory(itemId)` |
| `POST` | `/inventory/:itemId/reserve` body `{ amount }` | `reserveInventory` |
| `POST` | `/inventory/:itemId/commit` body `{ amount }` | `commitInventory` |
| `POST` | `/inventory/:itemId/abort` body `{ amount }` | `abortInventory` |
| `PATCH` | `/inventory/:itemId` body `{ amount }` | `update` (nhập kho) |

- `express.json()` để parse body.
- Middleware validate nhẹ: `itemId` phải là số nguyên, `amount` phải nguyên dương → nếu sai trả 400.
- Error handler tập trung: map lỗi domain (NotFound → 404, Conflict/OutOfStock → 409) sang HTTP.

---

## 6. Alternative Flow — Credit Card Charge Denied (Fig 22.15a)

Kịch bản trong ảnh bạn gửi: nhánh **thất bại** của use case *Confirm Shipment and Bill Customer*. Main flow (Fig 22.15) charge thành công; nhánh này charge **bị từ chối** → toàn bộ giao dịch **rollback theo 2PC** (Ch.16).

### 6.1. Diễn giải message trong ảnh (S1–S14)

| # | Message | Diễn giải |
|---|---|---|
| S1 | Supplier Input | Supplier báo sẵn sàng giao |
| S2 | Ready For Shipment | SupplierInteraction → SupplierCoordinator |
| S3 | Order Ready For Shipment | SupplierCoordinator → BillingCoordinator |
| S4 | Prepare To Commit | BillingCoordinator → DeliveryOrderService (prepare) |
| S5 | Invoice | DeliveryOrderService trả invoice (orderId, accountId, amount) |
| S6 / S7 | Account Request / Account Info | BillingCoordinator ↔ CustomerAccountService |
| **S8a** | **Commit Charge** | BillingCoordinator → CreditCardService |
| **S8b** | **Charge Denied** ⚠️ | thẻ bị từ chối → **kích hoạt rollback** |
| S9 | abort(orderId) | BillingCoordinator → DeliveryOrderService (hủy order) |
| S10 | Billing Failed, Order Aborted | BillingCoordinator → SupplierCoordinator |
| **S11** | **abortInventory(itemId, amount)** | SupplierCoordinator → **InventoryService** ← *phần của service này* |
| **S12** | **Items Released** | InventoryService xác nhận đã nhả giữ chỗ |
| S13 | Confirmation Response (billing failed, order aborted) | SupplierCoordinator → SupplierInteraction |
| S14 | Supplier Output (order aborted) | báo Supplier |

> So với main flow: S1–S7 **giống Fig 22.15**. Khác ở S8a fail → **2PC rollback** (S9 abort DO, S11 abortInventory). **Không** gửi email xác nhận (S8c bị bỏ) → EmailService **không** tham gia luồng này.

### 6.2. Phần InventoryService chịu trách nhiệm

Trong toàn bộ luồng rollback, InventoryService chỉ lộ diện ở **S11 → S12**:

```
SupplierCoordinator ──abortInventory(itemId, amount)──▶ InventoryService
                    ◀──────── Items Released ──────────
```

→ Chính là operation `abortInventory` ở Mục 4: `quantityReserved -= amount` (nhả hàng đã giữ, `quantity` giữ nguyên). **Không cần code mới** ngoài operation đã có — alternative flow được cover trọn vẹn bởi `abortInventory` + endpoint `POST /inventory/:itemId/abort`.

### 6.3. Contract phía ngoài (không code ở repo này, chỉ để hiểu)

- `BillingCoordinator` phát hiện `Charge Denied` và khởi động rollback (gọi `DeliveryOrderService.abort` + báo SupplierCoordinator).
- `SupplierCoordinator` gọi `InventoryService.abortInventory`.
- InventoryService **thụ động**: chỉ cần expose `POST /inventory/:itemId/abort` đúng contract là đủ.

---

## 7. Thứ tự thực hiện khi code (sau khi duyệt)

1. `package.json` (express, better-sqlite3) + `.gitignore`.
2. `src/db.js` — mở SQLite, tạo bảng `inventory` (+ CHECK constraints).
3. `src/inventory/inventory.status.js` — hằng InventoryStatusType.
4. `src/inventory/inventory.repository.js` — các câu SQL (raw).
5. `src/inventory/inventory.service.js` — logic 2PC (reserve/commit/abort/check/update) + transaction.
6. `src/inventory/inventory.routes.js` — Express router + validate + error mapping.
7. `src/server.js` — ráp app, mount `/inventory`, listen.
8. `src/seed.js` *(tùy chọn)* — nạp item mẫu.
9. `README.md` — cách chạy + ví dụ curl cho cả main flow (reserve→commit) và alternative flow (reserve→abort).

---

## 8. Điểm cần bạn xác nhận / có thể chỉnh

1. **Port & file DB**: đề xuất `3004` + `data/inventory.db`. OK không?
2. **`quantityAfterShipped`**: mình hiểu = `quantity - quantityReserved`. Nếu muốn nghĩa khác (vd `quantity - amount` của đơn đang xét) thì báo.
3. **Field `status` mở rộng trong InventoryStatus**: giữ (tiện cho caller) hay bỏ cho đúng 100% sách (chỉ 4 field số)?
4. **File `seed.js` + validate 400**: có cần không, hay chỉ 5 operation thuần?
```
