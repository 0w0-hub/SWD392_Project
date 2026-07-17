# Kịch bản thuyết trình — DeliveryOrderService (theo sách Gomaa, Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design*, **Chương 22 — Service-Oriented Architecture Case Study: Online Shopping System** (tr. 424–452).
> Bài này trình bày **Delivery Order Service** đúng theo cách sách thiết kế nó, rồi ánh xạ sang bản cài đặt của em (**NestJS + SQLite, TypeScript**).

---

## 0. Bố cục 3 phút đầu (nói gì trước)

1. Delivery Order Service là **1 trong 4 application service** của hệ Online Shopping theo SOA (sách §22.4, §22.7.2, Fig 22.10 & 22.17).
2. Nó cung cấp **một provided interface `IDeliveryOrderService`** với **10 thao tác** (Fig 22.22) — mỗi thao tác được **suy ra từ communication diagram** của một use case.
3. Đây là service được gọi bởi **cả 3 coordinator**: Customer, Supplier và Billing Coordinator (§22.7.6) — nó tham gia **nhiều use case** hơn Inventory Service.
4. Trong Confirm Shipment, nó là **participant của two-phase commit**: `prepareToCommitOrder` = *prepare* (S4), `commit`/`confirmPayment` = *commit payment* (S8b), `abort` = *rollback* (§22.7.3).
5. Em cài đặt đúng interface đó bằng NestJS controller (10 endpoint) + SQLite repository đúng schema thực thể **DeliveryOrder / Item / Invoice**.

---

## 1. Bối cảnh — Delivery Order Service nằm ở đâu trong hệ? (§22.1, §22.4)

Hệ **Online Shopping System** là ứng dụng phân tán trên Web, thiết kế theo **kiến trúc hướng dịch vụ (SOA)**. Có 2 tác nhân: **Customer** và **Supplier**.

Sách chia hệ thành nhiều **service class** (Fig 22.10 & 22.11):

- **Application services:** Catalog Service, **Delivery Order Service**, Inventory Service, Customer Account Service
- **External services:** Credit Card Service, Email Service
- **Coordinators** điều phối: Customer Coordinator, Supplier Coordinator, Billing Coordinator
- **User interaction:** Customer Interaction, Supplier Interaction

Sách (Fig 22.10): *"Delivery Order Service uses the **Delivery Order** and **Item** entity classes."*

> Câu chốt: *"Delivery Order Service là dịch vụ ở Layer 1 quản lý vòng đời của đơn giao hàng — từ lúc khách đặt (store) đến lúc supplier xử lý (select), chốt thanh toán (2PC) và khách tra cứu (read). Nó **thụ động**: chỉ chờ Coordinator gọi vào, không tự khởi động giao dịch."*

**Kiến trúc phân lớp (Layers of Abstraction, §22.7.2, Fig 22.17):**

```
Layer 3 — User Layer            : Customer / Supplier Interaction
Layer 2 — Coordination Layer    : Customer / Supplier / Billing Coordinator
Layer 1 — Service Layer         : Catalog, DELIVERY ORDER, Inventory, CustomerAccount, CreditCard, Email
```

Nguyên tắc: *"each component is in a layer where it depends on components in the layers below but not the layers above"* (§22.7.2). Delivery Order Service ở Layer 1 — bị các Coordinator ở Layer 2 gọi vào.

**Ai gọi Delivery Order Service?** (§22.7.6) — đây là điểm khác biệt so với Inventory Service:

| Coordinator | Use case | Gọi thao tác nào |
|---|---|---|
| **Customer Coordinator** | Make Order (M7), View Order (V3) | `store`, `read` |
| **Supplier Coordinator** | Process Delivery Order (D3) | `select` |
| **Billing Coordinator** | Confirm Shipment (S4, S5, S8b) | `prepareToCommitOrder`, `requestInvoice`, `confirmPayment`/`commit` |

Sách (§22.7.6): *"Customer Coordinator communicates with… Delivery Order Service"*; *"Supplier Coordinator communicates with both Delivery Order Service and Inventory Service"*; *"Billing Coordinator communicates with four services… (Delivery Order Service and Customer Account Service)."*

---

## 2. Mô hình tĩnh — thực thể DeliveryOrder, Item, Invoice (§22.3.2, Fig 22.9 & 22.22)

Sách định nghĩa 3 lớp thực thể quanh dịch vụ này (Fig 22.22):

**`DeliveryOrder`** (dữ liệu được lưu) — là **aggregation của `Item`** (quan hệ `1..*`):

| Thuộc tính (Fig 22.22) | Kiểu | Ý nghĩa |
|---|---|---|
| `orderId` | Integer | Khóa đơn |
| `orderStatus` | OrderStatus | Trạng thái đơn (enum) |
| `accountId` | Integer | Tài khoản khách |
| `amountDue` | Real | Số tiền phải trả |
| `authorizationId` | Integer | Mã ủy quyền thẻ |
| `supplierId` | Integer | Nhà cung cấp xử lý đơn |
| `creationDate` | Date | Ngày tạo |
| `plannedShipDate` | Date | Ngày dự kiến giao |
| `actualShipDate` | Date | Ngày giao thực tế |
| `paymentDate` | Date | Ngày thanh toán |
| `items : Item[1..*]` | | Danh sách dòng hàng |

**`Item`** (thành phần được aggregate): `itemId`, `unitCost`, `quantity`.

**`Invoice`** — sách nói rõ là **dẫn xuất**, không lưu bảng riêng: *"the Invoice entity class contains **data extracted from Delivery Order**"* (tr. 446). Gồm: `orderId`, `accountId`, `amountDue`, `actualShipDate`, `authorizationId`.

**`OrderStatus`** (enumeration, Fig 22.22): `NotYetShipped` → `PreparedForShipment` → `Shipped`.

**Ánh xạ sang code SQLite** (`delivery-order.repository.ts` + `schemas/`):

- `DeliveryOrder` → bảng `delivery_orders`: đủ 11 field trên; `orderId` là khóa chính, `orderStatus` có CHECK enum, và có index `(supplierId, orderStatus, creationDate)`.
- `Item` → bảng `delivery_order_items`: khóa ngoại `orderId` trỏ về `delivery_orders`, đúng nghĩa **aggregation** trong sách vì item chỉ tồn tại trong phạm vi order.
- `Item` → `schemas/item.schema.ts`: `itemId`, `unitCost`, `quantity` — khớp Fig 22.22.
- `Invoice` → `schemas/invoice.schema.ts`: là **plain class** (không `@Schema`), được **dựng động** từ DeliveryOrder trong `requestInvoice()` → đúng tinh thần "derived/extracted", không tạo collection riêng.
- `OrderStatus` → `enums/order-status.enum.ts`: `NotYetShipped | PreparedForShipment | Shipped` — trùng khít 3 giá trị của sách.

> Câu chốt: *"Invoice trong code không phải một collection — nó được nặn ra từ DeliveryOrder ngay lúc được hỏi, đúng như sách nói Invoice là dữ liệu trích xuất từ Delivery Order."*

---

## 3. Interface dịch vụ — `IDeliveryOrderService` (§22.7.5, Fig 22.22) — TRỌNG TÂM

Sách: *"Delivery Order Service has several operations (Figure 22.22), which are determined… Message M7 to store the delivery order corresponds to the **store** operation… Message D3 to select the delivery order… corresponds to the **select** operation… Further operations are determined from the Confirm Shipment and Bill Customer communication diagram, particularly the Delivery Order Service messages to **Prepare to Commit (message S4)** the order and **Commit the Payment (message S8b)**. The **read** operation is determined from message **V3** on the View Order communication diagram… The **abort** operation is invoked if the order is cancelled prior to shipment."*

Fig 22.22 liệt kê **đúng 10 operations**. Bảng ánh xạ **operation → message → endpoint thật → tác động OrderStatus**:

| Operation (Fig 22.22) | Message (use case) | Endpoint thật (controller) | Tác động OrderStatus |
|---|---|---|---|
| `store(order) → orderId` | **M7** Store Order (Make Order, Fig 22.13) | `POST /delivery-orders` | Tạo đơn, đặt `NotYetShipped` |
| `select(supplierId) → order` | **D3** Select Order (Process Delivery Order, Fig 22.14) | `GET /delivery-orders/supplier/:supplierId/next` | Đọc đơn `NotYetShipped` cũ nhất |
| `update(orderId, order) → orderStatus` | cập nhật chung (§22.7.5) | `PATCH /delivery-orders/:orderId` | Trả về status sau cập nhật |
| `orderShipped(orderId) → orderStatus` | đánh dấu đã giao | `POST /delivery-orders/:orderId/shipped` | → `Shipped` + set `actualShipDate` |
| `confirmPayment(orderId, amount) → orderStatus` | **S8b** Commit Payment (Fig 22.15) | `POST /delivery-orders/:orderId/payment-confirmation` | Kiểm `amount==amountDue`, set `paymentDate`, → `PreparedForShipment` |
| `read(orderId) → order` | **V3** Order Request (View Order, Fig 22.16) | `GET /delivery-orders/:orderId` | Chỉ đọc |
| `requestInvoice(orderId) → invoice` | **S5** Invoice / Ready to Commit (Fig 22.15) | `GET /delivery-orders/:orderId/invoice` | Trả `Invoice` dẫn xuất, không đổi status |
| `prepareToCommitOrder(orderId) → order` | **S4** Prepare To Commit (Fig 22.15) | `POST /delivery-orders/:orderId/prepare` | **PREPARE** → `PreparedForShipment` |
| `commit(orderId)` | **S8b** Commit (Fig 22.15) | `POST /delivery-orders/:orderId/commit` | **COMMIT** = gọi `orderShipped()` → `Shipped` |
| `abort(orderId)` | hủy đơn trước khi ship | `POST /delivery-orders/:orderId/abort` | **ROLLBACK** → `NotYetShipped`, xóa `paymentDate` & `actualShipDate` |

**Ánh xạ code:** contract khai báo ở `interfaces/idelivery-order.service.ts` (TypeScript `interface IDeliveryOrderService`, 10 method y hệt Fig 22.22), cài đặt ở `delivery-order.service.ts` (`class DeliveryOrderService implements IDeliveryOrderService`), lộ ra REST ở `delivery-order.controller.ts` (`@Controller('delivery-orders')`).

> Điểm ăn tiền: chữ ký trong code khớp **từng chữ** với Fig 22.22 — `store(in order, out orderId)`, `confirmPayment(in orderId, in amount, out orderStatus)`, `prepareToCommitOrder(in orderId, out order)`, `commit(in orderId)`, `abort(in orderId)`.

**Một khác biệt trung thực cần nêu:** trong sách, reply cho `prepare` (S4) chính là S5 = *Ready to Commit* kèm invoice. Trong code em **tách 2 bước cho rõ**: `prepareToCommitOrder` đặt trạng thái `PreparedForShipment` và trả về `order`, còn `requestInvoice` trả riêng đối tượng `Invoice` (S5). Cả hai đều do Billing Coordinator gọi trong pha prepare, nên vẫn đúng nghĩa "vote yes + đưa invoice".

---

## 4. Vai trò trong 4 use case — đọc communication diagram (§22.5.2–22.5.5)

Đây là phần "theo sách" đắt nhất: Delivery Order Service **xuất hiện trong 4 use case**, nhiều hơn hẳn Inventory Service.

### 4.1 Make Order Request (Fig 22.13) — `store` ← M7

Customer Coordinator điều phối. Sau khi lấy account (M3/M4) và duyệt thẻ (M5/M6):

```
M7 : Customer Coordinator → Delivery Order Service : Store Order
M8 : Delivery Order Service → Customer Coordinator : Order Confirmation
```

> Sách: *"The Customer Coordinator then sends a new order request to Delivery Order Service…"* — `store` tạo đơn mới, trả `orderId`, trạng thái khởi đầu `NotYetShipped`.

### 4.2 Process Delivery Order (Fig 22.14) — `select` ← D3

Supplier Coordinator điều phối:

```
D3 : Supplier Coordinator → Delivery Order Service : Select Order
D4 : Delivery Order Service → Supplier Coordinator : Selected Order
```

> Sách: *"D3: Supplier Coordinator requests Delivery Order Service to **select** a delivery order. D4: Delivery Order Service sends the delivery order to Supplier Coordinator."*
> Trong code, `select(supplierId)` lấy đơn `NotYetShipped` **cũ nhất** của supplier đó (`sort creationDate: 1`) — đúng ngữ nghĩa "đơn tiếp theo cần xử lý".

### 4.3 Confirm Shipment and Bill Customer (Fig 22.15) — `prepare`/`invoice`/`commit` ← S4, S5, S8b

Đây là **trái tim**. Billing Coordinator điều phối 2PC trên credit card + delivery order + inventory:

```
S4  : Billing Coordinator → Delivery Order Service : Prepare To Commit   (= prepareToCommitOrder)
S5  : Delivery Order Service → Billing Coordinator : Ready to Commit + Invoice (orderId, accountId, amount) (= requestInvoice)
...
S8b : Billing Coordinator → Delivery Order Service : Commit Payment      (= confirmPayment / commit)
```

> Sách: *"S4: Billing Coordinator sends **Prepare to Commit** order to Delivery Order Service. S5: Delivery Order Service replies with **Ready to Commit** message and invoice containing order Id, account Id, and amount."* … *"S8b: … **Commit Payment** message to Delivery Order Service."*
> *"The updates to the credit card, delivery order, and inventory are coordinated using the **two-phase commit protocol**."*

### 4.4 View Order (Fig 22.16) — `read` ← V3

Customer Coordinator điều phối:

```
V3 : Customer Coordinator → Delivery Order Service : Order Request   (= read)
V4 : Delivery Order Service → Customer Coordinator : Order Invoice
```

> Sách: *"V3: Customer Coordinator makes an order request to Delivery Order Service. V4: Delivery Order Service sends order invoice information to Customer Coordinator."*

---

## 5. Two-Phase Commit — vai trò participant của Delivery Order Service (§22.7.3, Fig 22.15)

Sách liệt kê 2PC là một **Architectural Communication Pattern**:

> *"**Two-Phase Commit.** This pattern is used to ensure that updates to inventory, credit card, and delivery order are **atomic**, so **either all updates are committed or all are aborted**."*

**Câu chuyện phải kể:**

> "Khi supplier báo sẵn sàng giao, Billing Coordinator mở một giao dịch phân tán trên 3 dịch vụ. **Pha 1 – Prepare:** nó gọi `prepareToCommitOrder` (S4) — Delivery Order Service chuyển đơn sang `PreparedForShipment` và trả về invoice qua `requestInvoice` (S5), nghĩa là **'tôi vote yes, sẵn sàng commit'**. **Pha 2 – Commit:** nếu mọi bên OK, Billing Coordinator gọi `confirmPayment` rồi `commit` (S8b) — đơn chuyển `Shipped` và ghi `actualShipDate`. Nếu **bất kỳ** bên nào từ chối, nó gọi `abort` — đơn quay về `NotYetShipped`, **xóa sạch** `paymentDate` và `actualShipDate`, coi như chưa từng chuẩn bị."

Vai trò ở đây là **participant thụ động**: Delivery Order Service chỉ **vote** (prepare thành công/thất bại) và **thực thi** lệnh commit/abort của Billing Coordinator, **không tự quyết** kết cục.

**Vì sao rollback sạch?** `prepareToCommitOrder` chỉ đổi `orderStatus`; `confirmPayment` mới ghi `paymentDate`; `commit` mới ghi `actualShipDate` + `Shipped`. Do đó `abort` chỉ cần đưa status về `NotYetShipped` và set 2 mốc ngày về `null` là khôi phục hoàn toàn — không có tác dụng phụ nào khác cần undo.

**Communication pattern:** toàn bộ tương tác coordinator ↔ Delivery Order Service dùng **Synchronous Message Communication with Reply** (§22.7.3) — *"used when the client needs information from the service and cannot proceed before receiving the response… used between coordinators and various services."* Đúng mô hình REST đồng bộ request/response của NestJS controller.

---

## 6. Điểm kỹ thuật đáng chú ý trong cài đặt

- **`confirmPayment` kiểm tra khớp tiền (guard S8b).** Trước khi ghi thanh toán, service so `amount` gửi lên với `order.amountDue`; lệch → ném `BadRequestException` (HTTP 400). Đây là "vote abort" tại chỗ: *"Payment amount … does not match order amount …"*. Coordinator không thể commit sai số tiền.
- **`commit` tái sử dụng `orderShipped`.** `commit(orderId)` gọi thẳng `orderShipped(orderId)` → cùng một hiệu ứng: `Shipped` + `actualShipDate = now`. Một nguồn sự thật duy nhất cho việc "đã giao".
- **`select` là hàng đợi FIFO theo supplier.** `findOne({ supplierId, orderStatus: NotYetShipped }).sort({ creationDate: 1 })` — luôn lấy đơn chờ lâu nhất; có **compound index** `{ supplierId, orderStatus, creationDate }` để truy vấn nhanh.
- **`getNextOrderId` tự cấp khóa.** Nếu client không gửi `orderId`, service lấy `max(orderId)+1` (bắt đầu từ 1) — giữ `orderId` là số nguyên tăng dần đúng kiểu `Integer` trong Fig 22.22.
- **Không tìm thấy đơn → 404.** Mọi thao tác đi qua `requireOrder(...)`; đơn không tồn tại → `NotFoundException`.

---

## 7. Ánh xạ Sách → Code (slide tổng kết)

| Khái niệm trong sách (Ch 22) | Nơi trong code |
|---|---|
| Thực thể `DeliveryOrder` (aggregation của `Item`) | `schemas/delivery-order.schema.ts` (+ `items: [ItemSchema]`) |
| Thực thể `Item` | `schemas/item.schema.ts` |
| `Invoice` (dữ liệu **dẫn xuất** từ DeliveryOrder) | `schemas/invoice.schema.ts` + `requestInvoice()` |
| Enum `OrderStatus` (3 giá trị) | `enums/order-status.enum.ts` |
| Interface `IDeliveryOrderService` (Fig 22.22) | `interfaces/idelivery-order.service.ts` |
| 10 operations (M7/D3/S4/S5/S8b/V3/…) | `delivery-order.service.ts` |
| 2PC: prepare / commit / abort | `prepareToCommitOrder` / `commit` / `abort` trong service |
| Provided interface qua 1 port | 10 REST route trong `delivery-order.controller.ts` |
| Đăng ký model + DI | `delivery-order.module.ts`, `app.module.ts` |
| Service Layer (Layer 1) chạy độc lập | `main.ts` (lắng nghe cổng `3001`) |

---

## 8. DEMO trực tiếp (cổng 3001)

```bash
cd DeliveryOrderService
pnpm install
pnpm run start:dev     # http://localhost:3001, SQLite: data/delivery-order.db
```

### 8.1 Luồng chính: Make Order → Process → Confirm Shipment (2PC commit)

**(M7) store — Customer Coordinator tạo đơn:**
```bash
curl -X POST http://localhost:3001/delivery-orders \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":501,\"amountDue\":250,\"authorizationId\":9001,\"supplierId\":10,\"items\":[{\"itemId\":1001,\"unitCost\":100,\"quantity\":2},{\"itemId\":1002,\"unitCost\":50,\"quantity\":1}]}"
# → { "orderId": 1 }   (orderStatus = NotYetShipped)
```

**(D3) select — Supplier Coordinator lấy đơn kế tiếp của supplier 10:**
```bash
curl http://localhost:3001/delivery-orders/supplier/10/next
# → đơn orderId=1, orderStatus=NotYetShipped
```

**(S4) prepare — Billing Coordinator: Prepare To Commit:**
```bash
curl -X POST http://localhost:3001/delivery-orders/1/prepare
# → order với orderStatus=PreparedForShipment  (vote: ready)
```

**(S5) invoice — lấy Ready-to-Commit invoice (dẫn xuất):**
```bash
curl http://localhost:3001/delivery-orders/1/invoice
# → { orderId:1, accountId:501, amountDue:250, actualShipDate:null, authorizationId:9001 }
```

**(S8b) payment-confirmation — Commit Payment, phải khớp amountDue=250:**
```bash
curl -X POST http://localhost:3001/delivery-orders/1/payment-confirmation \
  -H "Content-Type: application/json" -d "{\"amount\":250}"
# → { "orderStatus": "PreparedForShipment" }  (đã set paymentDate)
```

**(S8b) commit — chốt giao, chuyển Shipped:**
```bash
curl -X POST http://localhost:3001/delivery-orders/1/commit
# → { "committed": true }  (orderStatus=Shipped, actualShipDate=now)
```

**(V3) read — Customer Coordinator tra cứu đơn:**
```bash
curl http://localhost:3001/delivery-orders/1
# → toàn bộ đơn, orderStatus=Shipped
```

### 8.2 Luồng thay thế 1 — sai số tiền (vote abort tại chỗ)

```bash
curl -X POST http://localhost:3001/delivery-orders/1/payment-confirmation \
  -H "Content-Type: application/json" -d "{\"amount\":999}"
# → HTTP 400: "Payment amount 999 does not match order amount 250"
```

### 8.3 Luồng thay thế 2 — hủy đơn trước khi ship (rollback)

```bash
curl -X POST http://localhost:3001/delivery-orders/1/prepare              # PreparedForShipment
curl -X POST http://localhost:3001/delivery-orders/1/abort                # → { "aborted": true }
curl http://localhost:3001/delivery-orders/1
# → orderStatus=NotYetShipped, paymentDate=null, actualShipDate=null  (rollback sạch)
```

---

## 9. Câu hỏi có thể bị hỏi (chuẩn bị sẵn)

| Câu hỏi | Trả lời (bám sách) |
|---|---|
| Delivery Order Service làm gì trong hệ? | Application service Layer 1 quản lý thực thể **DeliveryOrder + Item**; cung cấp `IDeliveryOrderService` (Fig 22.22), được **cả 3 coordinator** gọi. |
| Vì sao nó tham gia nhiều use case hơn Inventory? | Nó xuất hiện ở **Make Order (M7)**, **Process Delivery Order (D3)**, **Confirm Shipment (S4/S5/S8b)** và **View Order (V3)** — trọn vòng đời đơn hàng. |
| `prepareToCommitOrder` khác `commit` chỗ nào? | prepare = **S4 prepare to commit** (chỉ đổi status → PreparedForShipment, vote yes); commit = **S8b** (gọi `orderShipped` → Shipped + actualShipDate). |
| `requestInvoice` ứng với message nào? | **S5** — *"replies with Ready to Commit message and invoice containing orderId, accountId, and amount."* Invoice là **dữ liệu trích xuất** từ DeliveryOrder, không phải bảng riêng. |
| Two-phase commit là gì, ai điều phối? | Prepare→Commit/Abort để cập nhật delivery order + credit card + inventory **atomic** (§22.7.3). **Billing Coordinator** điều phối; Delivery Order Service chỉ là **participant**. |
| Vì sao `abort` khôi phục được sạch? | prepare chỉ đổi status, chưa ghi ngày; nên abort chỉ cần đưa về `NotYetShipped` và set `paymentDate`/`actualShipDate` = null. |
| `confirmPayment` bảo vệ điều gì? | So khớp `amount` với `amountDue`; lệch → 400. Ngăn commit sai số tiền — an toàn cho pha commit. |
| Kiểu giao tiếp giữa Coordinator và service? | **Synchronous Message Communication with Reply** (§22.7.3) — client chờ phản hồi mới đi tiếp; đúng REST đồng bộ. |
| Sao DeliveryOrder dùng SQLite? | Để đồng nhất với các service demo còn lại; SOA vẫn yêu cầu quan trọng nhất là giữ đúng interface `IDeliveryOrderService`, còn persistence nằm bên trong service. |
| `Invoice` lưu ở đâu trong DB? | Không lưu — `requestInvoice()` nặn nó từ DeliveryOrder lúc runtime, đúng "data extracted from Delivery Order" (tr. 446). |

---

## 10. Câu kết mạnh

> "Đúng như sách Gomaa Chương 22, DeliveryOrderService của em là **application service Layer 1** phục vụ trọn vòng đời đơn hàng: expose đúng interface `IDeliveryOrderService` gồm 10 thao tác **suy ra trực tiếp từ communication diagram** (M7 store, D3 select, V3 read, S4/S5/S8b trong Confirm Shipment). Nó được **cả ba coordinator** gọi vào và đóng vai **participant prepare / commit / abort** trong two-phase commit do Billing Coordinator điều phối — bảo đảm mọi cập nhật đơn hàng là **atomic**, sẵn sàng để ghép vào hệ SOA."

---

## Phụ lục — Bản đồ mã nguồn (khi bị hỏi vào code)

- **Interface `IDeliveryOrderService`** → `src/delivery-order/interfaces/idelivery-order.service.ts` (10 method, dòng 5–16)
- **Cài đặt 10 operations** → `src/delivery-order/delivery-order.service.ts`:
  - `store` dòng 23, `select` dòng 36, `update` dòng 51, `orderShipped` dòng 63
  - `confirmPayment` (kiểm amountDue) dòng 79–101, `read` dòng 103
  - `requestInvoice` (dẫn xuất Invoice) dòng 108–118
  - `prepareToCommitOrder` dòng 120, `commit`(=orderShipped) dòng 132, `abort`(rollback) dòng 136–150
- **10 REST endpoint** → `src/delivery-order/delivery-order.controller.ts` (`@Controller('delivery-orders')`)
- **SQLite repository + schema/index** → `src/delivery-order/delivery-order.repository.ts`
- **Schema Item** → `src/delivery-order/schemas/item.schema.ts`
- **Class Invoice (derived)** → `src/delivery-order/schemas/invoice.schema.ts`
- **Enum OrderStatus** → `src/delivery-order/enums/order-status.enum.ts`
- **Đăng ký repository + DI** → `src/delivery-order/delivery-order.module.ts`
- **Bootstrap cổng 3001** → `src/main.ts` (dòng 6)
