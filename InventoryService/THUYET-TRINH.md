# Kịch bản thuyết trình — InventoryService (theo sách Gomaa, Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design*, **Chương 22 — Service-Oriented Architecture Case Study: Online Shopping System** (tr. 424–452).
> Bài này trình bày **Inventory Service** đúng theo cách sách thiết kế nó, rồi ánh xạ sang bản cài đặt của em (**Express + SQLite / better-sqlite3, JavaScript thuần**).

---

## 0. Bố cục 3 phút đầu (nói gì trước)

1. Inventory Service là **1 trong 6 dịch vụ** của hệ Online Shopping theo SOA (sách §22.4, §22.7.2).
2. Nó chỉ **cung cấp 1 interface `IInventoryService`** với **5 thao tác** (Fig 22.23) — thụ động, không tự điều phối.
3. Nó là **participant trong two-phase commit**: `reserveInventory` = *prepare*, `commitInventory` = *commit*, `abortInventory` = *rollback* (sách §22.5.3, §22.5.4, §22.7.3).
4. Em cài đặt đúng interface đó, mỗi thao tác ghi là **một câu SQL atomic** để đảm bảo nhất quán tồn kho.

---

## 1. Bối cảnh — Inventory Service nằm ở đâu trong hệ? (§22.1, §22.4)

Hệ **Online Shopping System** là ứng dụng phân tán trên Web, thiết kế theo **kiến trúc hướng dịch vụ (SOA)**. Có 2 tác nhân: **Customer** và **Supplier**.

Sách chia hệ thành nhiều **service class** (Fig 22.10 & 22.11):

- **Application services:** Catalog Service, Delivery Order Service, **Inventory Service**, Customer Account Service
- **External services:** Credit Card Service, Email Service
- **Coordinators** điều phối: Customer Coordinator, Supplier Coordinator, Billing Coordinator
- **User interaction:** Customer Interaction, Supplier Interaction

> Câu chốt: *"Inventory Service chỉ quản lý thực thể **Inventory** (Fig 22.10) — nó là dịch vụ ở tầng thấp nhất, được các Coordinator gọi vào, chứ không tự khởi động giao dịch."*

**Kiến trúc phân lớp (Layers of Abstraction, §22.7.2, Fig 22.17):**

```
Layer 3 — User Layer            : Customer/Supplier Interaction
Layer 2 — Coordination Layer    : Customer / Supplier / Billing Coordinator
Layer 1 — Service Layer         : Catalog, DeliveryOrder, INVENTORY, CustomerAccount, CreditCard, Email
```

Nguyên tắc: lớp trên phụ thuộc lớp dưới, **không ngược lại**. Inventory Service ở Layer 1 — bị Supplier Coordinator (Layer 2) gọi.

---

## 2. Mô hình tĩnh — thực thể Inventory (§22.3.2, Fig 22.9 & 22.23)

Sách định nghĩa 2 lớp thực thể liên quan đến dịch vụ này:

**`Inventory`** (dữ liệu được lưu):

| Thuộc tính | Ý nghĩa |
|---|---|
| `itemId` | Khóa |
| `itemDescription` | Mô tả |
| `quantity` | **Tổng hàng thực tế** trong kho |
| `quantityReserved` | Số đã **giữ chỗ** cho đơn nhưng **chưa xuất** |
| `price` | Giá |
| `reorderTime` | Mốc đặt hàng lại |

**`InventoryStatus`** (object *trả về*, sách nói rõ là **dẫn xuất**, không lưu bảng):

| Thuộc tính | Công thức |
|---|---|
| `currentAmount` | = `quantity` (hàng đang có) |
| `quantityAfterShipped` | = `quantity − quantityReserved` (còn lại sau khi hàng đã-giữ xuất đi) |

> **Công thức vàng:** *Số hàng còn nhận đơn được = `quantity − quantityReserved`*.

**Ánh xạ sang code** (`src/db.js`): em cài đúng schema này và ép **bất biến** ngay trong DB:

```sql
CHECK (quantityReserved >= 0)
CHECK (quantityReserved <= quantity)
```

> *"Dù code có bug, database vẫn không cho phép giữ chỗ vượt quá số hàng có."*

---

## 3. Interface dịch vụ — `IInventoryService` (§22.7.5, Fig 22.23) — TRỌNG TÂM

Sách nói: *mỗi dịch vụ có **một provided interface**; các thao tác được **suy ra từ communication diagram** của từng use case.* Fig 22.23 cho Inventory Service gồm **đúng 5 operations**:

| Operation (Fig 22.23) | Suy ra từ message | Vai trò 2PC | Việc làm |
|---|---|---|---|
| `checkInventory(itemId)` | **D5** (Fig 22.14) | Đọc | Trả về `InventoryStatus` |
| `reserveInventory(itemId, amount)` | **D11** (Fig 22.14) | **PREPARE TO COMMIT** | Giữ chỗ: `quantityReserved += amount` |
| `commitInventory(itemId, amount)` | **S9** (Fig 22.15) | **COMMIT** | Xuất thật: `quantity -= amount; quantityReserved -= amount` |
| `abortInventory(itemId, amount)` | (hủy đơn trước khi ship) | **ROLLBACK** | Nhả giữ chỗ: `quantityReserved -= amount`, `quantity` **không đổi** |
| `update(itemId, amount)` | nhập kho (§22.7.5) | Ngoài 2PC | `quantity += amount` khi bổ sung hàng |

> Sách (tr. 448): *"Inventory Service needs operations to **check inventory** (D5); **reserve inventory** (D11), which is **equivalent to prepare to commit**; **commit inventory** (S9); and **update inventory**… The **abort** operation is invoked if the order is cancelled and inventory released prior to shipment."*

**Ánh xạ code:** contract khai báo ở `src/inventory/iinventory.service.js` (JS không có `interface` nên dùng JSDoc `@interface IInventoryService`), cài đặt ở `src/inventory/inventory.service.js`.

---

## 4. Vai trò trong 2 use case — đọc communication diagram (§22.5.3 & §22.5.4)

Đây là phần **"theo sách"** đắt nhất: chỉ ra chính xác Inventory Service được gọi ở đâu.

### 4.1 Process Delivery Order (Fig 22.14) — kiểm tra & giữ chỗ

Supplier Coordinator điều phối. Chuỗi liên quan Inventory Service:

```
D5 : Supplier Coordinator → Inventory Service : checkInventory
D6 : Inventory Service    → Supplier Coordinator : Item Info
...
D11: Supplier Coordinator → Inventory Service : reserveInventory   (= Prepare to Commit)
D12: Inventory Service    → Supplier Coordinator : Items Reserved   (= Ready to Commit)
```

> Sách: *"D11: Supplier Coordinator requests Inventory Service to **reserve** the items (this is equivalent to a **Prepare to Commit** message). D12: Inventory Service **confirms reservation** (equivalent to a **Ready to Commit** message)."*
> Luồng thay thế: item hết hàng → Inventory Service trả **Out of Stock** (sách §22.5.3 cuối).

### 4.2 Confirm Shipment and Bill Customer (Fig 22.15) — chốt giao dịch

Khi Supplier xác nhận sẵn sàng giao, **Billing Coordinator** điều phối 2PC trên 3 dịch vụ (inventory + credit card + delivery order). Chuỗi liên quan Inventory Service:

```
S9 : Supplier Coordinator → Inventory Service : commitInventory
S10: Inventory Service    → Supplier Coordinator : Commit Completed
S11/S12: Confirmation Response → Supplier
```

> Sách: *"The updates to the credit card, delivery order, and inventory are coordinated using the **two-phase commit protocol** (see Chapter 16)."*

---

## 5. Two-Phase Commit — vì sao tách reserve/commit/abort (§22.7.3)

Sách liệt kê 2PC là một **Architectural Communication Pattern**:

> *"**Two-Phase Commit.** This pattern is used to ensure that updates to inventory, credit card, and delivery order are **atomic**, so **either all updates are committed or all are aborted**."*

**Câu chuyện phải kể để người nghe hiểu:**

> "Khi Supplier xử lý đơn, ta **chưa trừ kho** ngay mà chỉ **giữ chỗ** (`reserveInventory` = *prepare*). Coordinator đợi tất cả dịch vụ 'vote yes'. Nếu mọi bên OK → **`commitInventory`** (trừ kho thật). Nếu bất kỳ bên nào từ chối → **`abortInventory`** (nhả chỗ giữ, kho về nguyên trạng). Nhờ tách 'giữ chỗ' và 'trừ thật', **rollback rất sạch** — vì `reserve` chưa từng đụng `quantity`."

Vai trò của Inventory Service ở đây là **participant thụ động**: nó chỉ vote (reserve thành công/thất bại) và thực thi lệnh commit/abort của Coordinator, **không tự quyết** kết cục giao dịch.

---

## 6. Điểm kỹ thuật đắt giá nhất — atomic, chống race condition (`inventory.repository.js`)

Đây là chỗ ghi điểm về cài đặt. Câu SQL `reserve`:

```sql
UPDATE inventory
   SET quantityReserved = quantityReserved + @amount
 WHERE itemId = @itemId
   AND (quantity - quantityReserved) >= @amount   -- ← điều kiện NẰM TRONG WHERE
```

> "Thay vì đọc tồn kho rồi mới ghi (read-then-write — có khe hở cho 2 đơn cùng giành 1 món), em đặt điều kiện kiểm tra **ngay trong WHERE**. Đây là **một câu lệnh atomic duy nhất**. Nếu không đủ hàng → `changes === 0` → code ném lỗi 409 (= *vote abort*). Không có race condition."

→ Chính vì cần transaction đồng bộ + atomic sạch nên em chọn **SQLite + better-sqlite3**. Mọi thao tác ghi được bọc trong `db.transaction(...)` (xem `inventory.service.js`) để existence-check + guarded-write không bị đơn khác chen giữa.

---

## 7. Xử lý lỗi = ngữ nghĩa "vote" của participant (`errors.js` + `server.js`)

| Lỗi domain | HTTP | Ý nghĩa theo sách |
|---|---|---|
| `NotFoundError` | 404 | item không tồn tại |
| `ConflictError` | 409 | hết hàng / không đủ reserved = **"Out of Stock" / vote abort** |
| `ValidationError` | 400 | itemId/amount sai |

Một **error handler tập trung** ở `server.js` map lỗi domain → HTTP response.

---

## 8. Ánh xạ Sách → Code (slide tổng kết)

| Khái niệm trong sách (Ch 22) | Nơi trong code |
|---|---|
| Thực thể `Inventory` + bất biến | `src/db.js` (schema + CHECK) |
| `InventoryStatus` (dẫn xuất) | `toInventoryStatus()` trong `inventory.service.js` |
| Interface `IInventoryService` (Fig 22.23) | `src/inventory/iinventory.service.js` |
| 5 operations (D5/D11/S9/abort/update) | `inventory.service.js` |
| Prepare-to-commit atomic | câu SQL `reserve` trong `inventory.repository.js` |
| Provided interface qua 1 port | REST routes trong `inventory.routes.js` |

---

## 9. DEMO trực tiếp

```bash
cd InventoryService
npm install
npm run seed     # item mẫu: 1001, 1002, 1003
npm start        # http://localhost:3004
```

**Luồng chính (Process Delivery Order → Confirm Shipment): reserve → commit**

```bash
curl http://localhost:3004/inventory/1001/check
curl -X POST http://localhost:3004/inventory/1001/reserve -H "Content-Type: application/json" -d "{\"amount\":2}"
curl -X POST http://localhost:3004/inventory/1001/commit  -H "Content-Type: application/json" -d "{\"amount\":2}"
```
→ Sau commit: `quantity` giảm 2, `quantityReserved` về 0. (đúng S9→S10)

**Luồng thay thế — hủy đơn: reserve → abort** (rollback, "Items Released")

```bash
curl -X POST http://localhost:3004/inventory/1001/reserve -H "Content-Type: application/json" -d "{\"amount\":2}"
curl -X POST http://localhost:3004/inventory/1001/abort   -H "Content-Type: application/json" -d "{\"amount\":2}"
```
→ Cho xem `check` trước/sau: `quantity` **KHÔNG đổi** khi abort → đúng nghĩa rollback.

**Demo hết hàng (Out of Stock, §22.5.3):** reserve item 1003 (chỉ có 3) với `amount: 99` → trả **409**.

---

## 10. Câu hỏi có thể bị hỏi (chuẩn bị sẵn)

| Câu hỏi | Trả lời (bám sách) |
|---|---|
| Inventory Service làm gì trong hệ? | Dịch vụ Layer 1 quản lý thực thể Inventory; cung cấp `IInventoryService` (Fig 22.23), được Supplier Coordinator gọi. |
| `reserveInventory` khác `commitInventory` chỗ nào? | reserve = **prepare to commit** (D11, chỉ giữ chỗ); commit = **commit** (S9, trừ kho thật). Sách tr. 448 nói rõ. |
| Two-phase commit là gì và ai điều phối? | Prepare→Commit/Abort để cập nhật inventory + credit card + delivery order **atomic** (§22.7.3). Billing/Supplier Coordinator điều phối, Inventory chỉ là participant. |
| Tại sao abort không đụng `quantity`? | Vì reserve chỉ tăng `quantityReserved`, chưa từng trừ `quantity`. Abort chỉ trả lại phần giữ chỗ → rollback sạch. |
| Chống 2 người mua cùng lúc? | Điều kiện `(quantity - quantityReserved) >= amount` nằm **trong WHERE** + transaction; `changes === 0` ⇒ vote abort. Atomic, không read-then-write. |
| Sao dùng Express + SQLite mà không giống CatalogService? | SOA cho phép mỗi service tự chọn stack miễn tuân đúng interface (§22.7.6 — binding động qua broker). Đây là tính độc lập của service. |

---

## 11. Câu kết mạnh

> "Đúng như sách Gomaa Chương 22, Inventory Service của em là một **participant thụ động trong SOA**: expose đúng interface `IInventoryService` gồm 5 thao tác suy ra từ communication diagram, đóng vai **prepare / commit / abort** trong two-phase commit, và bảo đảm nhất quán tồn kho bằng các thao tác **atomic** — sẵn sàng để Coordinator gọi vào."

---

## Phụ lục — Bản đồ mã nguồn (khi bị hỏi vào code)

- **Schema + bất biến** → `src/db.js` (CHECK dòng 37–38)
- **Interface `IInventoryService`** → `src/inventory/iinventory.service.js`
- **Logic 2PC** → `src/inventory/inventory.service.js` (reserve 48, commit 60, abort 73, update 80)
- **Câu SQL atomic** → `src/inventory/inventory.repository.js` (reserve 11–16, commit 18–24)
- **Map route → service** → `src/inventory/inventory.routes.js`
- **Map lỗi → HTTP** → `src/server.js` + `src/errors.js`
</content>
</invoke>
