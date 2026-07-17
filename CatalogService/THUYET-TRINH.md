# Kịch bản thuyết trình — CatalogService (theo sách Gomaa, Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design*, **Chương 22 — Service-Oriented Architecture Case Study: Online Shopping System** (tr. 424–452).
> Bài này trình bày **Catalog Service** đúng theo cách sách thiết kế nó, rồi ánh xạ sang bản cài đặt của em (**NestJS + MongoDB / Mongoose, TypeScript**).

---

## 0. Bố cục 3 phút đầu (nói gì trước)

1. Catalog Service là **1 trong 6 dịch vụ** của hệ Online Shopping theo SOA (sách §22.4, §22.7.2) — thuộc nhóm **application service** ở Layer 1.
2. Nó chỉ **cung cấp 1 provided interface `ICatalogService`** với **đúng 2 thao tác** (Fig 22.20): `requestCatalog` và `requestSelection` — thụ động, không tự điều phối.
3. Nó phục vụ **use case Browse Catalog** (§22.2.1), được **Customer Coordinator** gọi vào: `requestCatalog` suy ra từ message **B3**, `requestSelection` suy ra từ message **B9**.
4. Em cài đúng interface đó bằng NestJS + Mongoose; mỗi thao tác là một truy vấn đọc trên MongoDB (`find` / `findOne`).

---

## 1. Bối cảnh — Catalog Service nằm ở đâu trong hệ? (§22.1, §22.4)

Hệ **Online Shopping System** là ứng dụng phân tán trên Web, thiết kế theo **kiến trúc hướng dịch vụ (SOA)**. Có 2 tác nhân: **Customer** và **Supplier**.

Sách chia hệ thành nhiều **service class** (Fig 22.10 & 22.11):

- **Application services:** **Catalog Service**, Delivery Order Service, Inventory Service, Customer Account Service
- **External services:** Credit Card Service, Email Service
- **Coordinators** điều phối: Customer Coordinator, Supplier Coordinator, Billing Coordinator
- **User interaction:** Customer Interaction, Supplier Interaction

Sách nói rõ (§22.4, tr. 432): *"Catalog Service uses the **Catalog** and **Supplier** entity classes."* Đây là dịch vụ mà **Customer** dùng để **duyệt và chọn hàng**.

> Câu chốt: *"Catalog Service là dịch vụ ở tầng thấp nhất (Layer 1), quản lý thực thể **Catalog** và **Supplier**. Nó **bị Customer Coordinator gọi vào**, chứ không tự khởi động giao dịch — nó chỉ trả lời truy vấn đọc."*

**Kiến trúc phân lớp (Layers of Abstraction, §22.7.2, Fig 22.17):**

```
Layer 3 — User Layer            : Customer / Supplier Interaction
Layer 2 — Coordination Layer    : Customer / Supplier / Billing Coordinator
Layer 1 — Service Layer         : CATALOG, DeliveryOrder, Inventory, CustomerAccount, CreditCard, Email
```

Nguyên tắc: lớp trên phụ thuộc lớp dưới, **không ngược lại** (§22.7.2). Catalog Service ở Layer 1 — bị Customer Coordinator (Layer 2) gọi. Theo Fig 22.25 & §22.7.6: *"the Customer Coordinator communicates with five services… three application services (**Catalog Service**, Delivery Order Service, and Customer Account Service)."*

---

## 2. Mô hình tĩnh — thực thể Catalog Info, Item Info & Supplier (§22.3.2, Fig 22.8, 22.9, 22.20)

Sách (§22.3.2, Fig 22.8) định nghĩa quan hệ tĩnh: **Supplier** *Provides* **Catalog**; **Catalog** *Described in* **Item** (1 catalog gồm `1..*` item); **Customer** *Views* **Catalog**. Riêng cho Catalog Service, Fig 22.20 tách ra 2 lớp thực thể mà interface truy cập:

**`CatalogInfo`** (Fig 22.20 — dữ liệu catalog):

| Thuộc tính (sách) | Ý nghĩa |
|---|---|
| `catalogId : Integer` | Khóa của catalog |
| `catalogDescription : String` | Mô tả catalog |
| `supplierId : Integer` | Nhà cung cấp sở hữu catalog |
| `catalogType : CatalogType` | Loại catalog (enum) |

**`ItemInfo`** (Fig 22.20 — quan hệ `1..*` với CatalogInfo):

| Thuộc tính (sách) | Ý nghĩa |
|---|---|
| `itemId : Integer` | Khóa của item |
| `itemDescription : String` | Mô tả item |
| `unitCost : Real` | Đơn giá |
| `supplierId : Integer` | Nhà cung cấp |
| `itemDetails : URL` | Link chi tiết item |

**`Supplier`** (Fig 22.9 — nhà cung cấp *Provides* catalog): `supplierId`, `supplierName`, `address`, `telephoneNumber`, `faxNumber`, `email`.

**Ánh xạ sang code (Mongoose schema) — liệt kê đúng field có trong code:**

| Schema code | File | Field thật trong code |
|---|---|---|
| `CatalogInfo` | `src/catalog/schemas/catalog-info.schema.ts` | `catalogId`, `catalogDescription`, `supplierId`, `catalogType` (enum String), `items: [ref 'ItemInfo']` |
| `ItemInfo` | `src/catalog/schemas/item-info.schema.ts` | `itemId`, `itemDescription`, `unitCost`, `supplierId`, `itemDetails` |
| `Supplier` | `src/catalog/schemas/supplier.schema.ts` | `supplierId`, `supplierName`, `address`, `telephoneNumber`, `faxNumber`, `email` |

> **Điểm đáng nói:** quan hệ `1..*` giữa CatalogInfo và ItemInfo (Fig 22.20) được hiện thực bằng **document reference** trong Mongo: `CatalogInfo.items` là mảng `ObjectId` tham chiếu `ItemInfo` (`@Prop({ type: [{ type: Types.ObjectId, ref: 'ItemInfo' }] })`). Khi trả catalog, code dùng `.populate('items')` để nạp đúng danh sách item — chính là quan hệ *"Catalog Described in Item"* của Fig 22.8.

---

## 3. Interface dịch vụ — `ICatalogService` (§22.7.5, Fig 22.20) — TRỌNG TÂM

Sách nói: *"Each service has **one provided interface** through which the service operations are accessed"* (§22.7.5), và *các thao tác được **suy ra từ communication diagram** của từng use case*. Fig 22.20 cho Catalog Service gồm **đúng 2 operations**:

```
�interface� ICatalogService
    requestCatalog   (in catalogType, out catalogInfo)
    requestSelection (in itemId,      out itemInfo)
```

Sách giải thích rõ nguồn gốc từng thao tác (tr. 445, quanh Fig 22.20):

> *"The **requestCatalog** operation returns catalog items of a given type and is determined from message **B3** in Figure 22.12. The catalog information returned is given by the attributes of the Catalog entity class… The **requestSelection** operation is determined from message **B9** in Figure 22.12, which returns (determined from message **B10**) the item information for the specific item."*

| Operation (Fig 22.20) | Suy ra từ message | Input → Output | Việc làm |
|---|---|---|---|
| `requestCatalog(in catalogType, out catalogInfo)` | **B3** (trả về ở B4) | `catalogType` → `CatalogInfo[]` | Trả các catalog thuộc một loại, kèm item |
| `requestSelection(in itemId, out itemInfo)` | **B9** (trả về ở B10) | `itemId` → `ItemInfo` | Trả thông tin + giá của item đã chọn |

**Ánh xạ code:** contract khai báo ở `src/catalog/interfaces/icatalog.service.ts` (TypeScript có `interface` thật):

```ts
export interface ICatalogService {
  requestCatalog(catalogType: CatalogType): Promise<CatalogInfo[]>;
  requestSelection(itemId: number): Promise<ItemInfo>;
}
```

Lớp cài đặt `CatalogService implements ICatalogService` (`src/catalog/catalog.service.ts`) và **provided port** được expose qua REST controller (`src/catalog/catalog.controller.ts`):

| Operation sách | Method + route thật | Tham số |
|---|---|---|
| `requestCatalog` | `GET /catalog?type=<CatalogType>` | `@Query('type')` |
| `requestSelection` | `GET /catalog/item/:id` | `@Param('id', ParseIntPipe)` |

> Đây chính là *"one port with one provided interface"* của Fig 22.19/22.25: một `@Controller('catalog')` = một port, 2 route = 2 operation của `ICatalogService`.

---

## 4. Vai trò trong use case Browse Catalog — đọc communication diagram (§22.2.1, §22.5.1)

Đây là phần **"theo sách"** đắt nhất: chỉ ra chính xác Catalog Service được gọi ở đâu.

### 4.1 Use case Browse Catalog (§22.2.1, activity diagram Fig 22.2)

Mô tả use case (tr. 426): Customer *"browses a World Wide Web catalog, views various catalog items from a given supplier's catalog, and selects items from the catalog."* Activity diagram Fig 22.2 gồm chuỗi: Request Catalog Information → Request Catalog Items → Display Catalog Items → Request Items from Catalog → Select Items from Catalog → Display Items and Total Price.

### 4.2 Communication diagram (Fig 22.12) — 12 message B1–B12

Customer Interaction ↔ Customer Coordinator ↔ **Catalog Service**. Hai lần Coordinator gọi vào Catalog Service là **B3** và **B9**:

```
B1 : Customer          → Customer Interaction   : Catalog Request (customer input)
B2 : (Customer Coordinator được khởi tạo, chọn catalog để duyệt)
B3 : Customer Coordinator → Catalog Service      : Catalog Request      ← requestCatalog()
B4 : Catalog Service     → Customer Coordinator  : Catalog Info         ← giá trị trả về
B5 : Customer Coordinator → Customer Interaction  : Catalog Info
B6 : Customer Interaction → Customer             : Catalog Output (hiển thị)
B7 : Customer          → Customer Interaction    : Catalog Selection (customer input)
B8 : Customer Interaction → Customer Coordinator  : Catalog Selection
B9 : Customer Coordinator → Catalog Service      : Catalog Selection    ← requestSelection()
B10: Catalog Service     → Customer Coordinator  : Selection Confirmation (giá + xác nhận có hàng)
B11: Customer Coordinator → Customer Interaction  : Selection Confirmation
B12: Customer Interaction → Customer             : Catalog Output (giá item + tổng)
```

> Sách (§22.5.1):
> *"B3: Customer Coordinator requests information from Catalog Service. B4: Catalog Service sends catalog information to Customer Coordinator… B9: Customer Coordinator requests the catalog selection from Catalog Service. B10: Catalog Service **confirms the availability** of the catalog items and sends the **item prices** to Customer Coordinator."*

**Vai trò của Catalog Service ở đây là dịch vụ đọc thụ động:** nó chỉ trả lời 2 truy vấn (B3→B4, B9→B10). Toàn bộ việc dựng UI, ghép tổng giá (B12) do Customer Interaction/Coordinator lo — không phải việc của Catalog Service.

**Ánh xạ luồng B3/B9 vào code:**

- **B3 → B4** = `GET /catalog?type=Books` → `CatalogController.requestCatalog()` → `CatalogService.requestCatalog()` → `catalogInfoModel.find({ catalogType }).populate('items')` → trả `CatalogInfo[]` (kèm item = *catalog info*).
- **B9 → B10** = `GET /catalog/item/1001` → `CatalogController.requestSelection()` → `CatalogService.requestSelection()` → `itemInfoModel.findOne({ itemId })` → trả `ItemInfo` (có `unitCost` = *item price* của B10). Nếu không tìm thấy → `NotFoundException` (404).

---

## 5. Communication pattern — Synchronous Message Communication with Reply (§22.7.3)

Sách liệt kê đây là mẫu giao tiếp chủ đạo của SOA (§22.7.3):

> *"**Synchronous Message Communication with Reply.** This is the typical service-oriented architecture pattern of communication and is used when the client needs information from the service and **cannot proceed before receiving the response**. This pattern is used between user interaction clients and coordinators. It is also used between **coordinators and various services**."*

**Câu chuyện phải kể:**

> "Customer Coordinator gọi `requestCatalog` (B3) rồi **đứng chờ** tới khi Catalog Service trả về (B4) mới hiển thị được cho khách. Client bị *suspend* trong lúc chờ — đúng nghĩa *synchronous with reply*. Trong bản cài của em, đây là một **HTTP request/response đồng bộ**: Coordinator `GET /catalog?type=...` và block chờ JSON trả về. Catalog Service **không** tham gia two-phase commit (khác Inventory/CreditCard/DeliveryOrder) vì nó chỉ đọc, không cập nhật trạng thái."

Ngoài ra Catalog Service còn dính đến 2 pattern hạ tầng của §22.7.3: **Broker Handle** (đăng ký service name + location với broker) và **Service Discovery** — sách nói thẳng: *"Service Discovery patterns… could be used to discover new **catalogs to browse**."*

---

## 6. Tính độc lập của service trong SOA — vì sao được phép dùng NestJS + Mongo (§22.7.6)

Sách nhấn mạnh **binding động** giữa service provider và requester (§22.7.6, Fig 22.25):

> *"The provided interfaces of the services and the required ports of the coordinators are explicitly depicted in order to identify that services are intended to be discovered; thus, the **binding between the service provider and the service requester is dynamic**."*

Và với ví dụ Credit Card Service (§22.7.6): *"Each service instance is **designed and implemented differently** but must **conform to the SOA … interface**."*

> "Vì binding là động qua broker và mỗi service chỉ cần **tuân đúng provided interface**, Catalog Service của em được tự do chọn stack **NestJS + MongoDB/Mongoose**, trong khi Inventory Service dùng Express + SQLite. Miễn hai route `GET /catalog` và `GET /catalog/item/:id` phản hồi đúng ngữ nghĩa `ICatalogService` (Fig 22.20), Customer Coordinator không cần biết bên trong là Mongo hay SQL. Đó chính là **tính độc lập của service** trong SOA." (§22.8 còn nói Catalog Service là dịch vụ **tái sử dụng được** cho cả hệ B2B.)

---

## 7. Ánh xạ Sách → Code (slide tổng kết)

| Khái niệm trong sách (Ch 22) | Nơi trong code |
|---|---|
| Thực thể `CatalogInfo` (Fig 22.20) | `src/catalog/schemas/catalog-info.schema.ts` |
| Thực thể `ItemInfo` (Fig 22.20) | `src/catalog/schemas/item-info.schema.ts` |
| Thực thể `Supplier` (Fig 22.9) | `src/catalog/schemas/supplier.schema.ts` |
| Enum `CatalogType` = {Books, Computers, Home, Toys} (Fig 22.20) | `src/catalog/enums/catalog-type.enum.ts` |
| Quan hệ Catalog `1..*` Item (Fig 22.8/22.20) | `items: [ref 'ItemInfo']` + `.populate('items')` |
| Interface `ICatalogService` (Fig 22.20) | `src/catalog/interfaces/icatalog.service.ts` |
| `requestCatalog` (từ B3) | `CatalogService.requestCatalog()` + `GET /catalog?type=` |
| `requestSelection` (từ B9, trả B10) | `CatalogService.requestSelection()` + `GET /catalog/item/:id` |
| Provided interface qua 1 port (Fig 22.19/22.25) | `@Controller('catalog')` trong `catalog.controller.ts` |
| Synchronous Message with Reply (§22.7.3) | HTTP request/response đồng bộ |

---

## 8. DEMO trực tiếp

Service chạy trên **port 3000** (`main.ts`: `process.env.PORT ?? 3000`) và kết nối **MongoDB** `mongodb://localhost:27017/catalog` (`app.module.ts`).

```bash
cd CatalogService
pnpm install
# cần một MongoDB đang chạy ở localhost:27017
pnpm start        # http://localhost:3000
```

**Nạp dữ liệu mẫu** (chưa có seed script — nạp trực tiếp qua mongosh):

```bash
mongosh mongodb://localhost:27017/catalog --eval '
  const items = db.iteminfos.insertMany([
    { itemId: 1001, itemDescription: "Clean Code", unitCost: 32.5, supplierId: 1, itemDetails: "http://x/1001" },
    { itemId: 1002, itemDescription: "SW Modeling & Design", unitCost: 55.0, supplierId: 1, itemDetails: "http://x/1002" }
  ]);
  db.cataloginfos.insertOne({
    catalogId: 1, catalogDescription: "Book catalog", supplierId: 1,
    catalogType: "Books", items: Object.values(items.insertedIds)
  });
'
```

**Luồng chính (Browse Catalog):**

```bash
# B3 → B4 : requestCatalog(catalogType=Books) → trả CatalogInfo[] kèm items đã populate
curl "http://localhost:3000/catalog?type=Books"

# B9 → B10 : requestSelection(itemId=1001) → trả ItemInfo, unitCost = "item price"
curl "http://localhost:3000/catalog/item/1001"
```

**Luồng thay thế — item không tồn tại (404):**

```bash
curl -i "http://localhost:3000/catalog/item/9999"   # → 404 Not Found: "Item with ID 9999 not found"
```

> Lưu ý demo: `type` phải là một trong `Books | Computers | Home | Toys` (enum `CatalogType`). Gọi `GET /catalog` không kèm `type` sẽ khớp `catalogType: undefined` → trả mảng rỗng.

---

## 9. Câu hỏi có thể bị hỏi (chuẩn bị sẵn)

| Câu hỏi | Trả lời (bám sách) |
|---|---|
| Catalog Service làm gì trong hệ? | Application service ở Layer 1, quản lý thực thể **Catalog** và **Supplier** (§22.4); cung cấp `ICatalogService` (Fig 22.20) với 2 thao tác, được **Customer Coordinator** gọi để duyệt/chọn hàng. |
| `requestCatalog` và `requestSelection` suy ra từ đâu? | Từ **communication diagram Browse Catalog** (Fig 22.12): `requestCatalog` từ message **B3**, `requestSelection` từ **B9** (trả về ở **B10**). Sách nói rõ ở đoạn quanh Fig 22.20. |
| Vì sao Catalog Service không có commit/abort như Inventory? | Vì nó **chỉ đọc** (browse/select), không cập nhật trạng thái, nên **không tham gia two-phase commit** (2PC chỉ dành cho inventory + credit card + delivery order, §22.7.3). Pattern của nó là **Synchronous Message with Reply**. |
| Ai gọi Catalog Service, gọi thế nào? | **Customer Coordinator** (Layer 2) gọi **đồng bộ** và chờ trả lời (§22.7.3). Trong code là HTTP `GET` request/response. |
| Quan hệ Catalog–Item cài ra sao? | Fig 22.8/22.20 là `1..*`. Code hiện thực bằng mảng reference `items` trong `CatalogInfo` + `.populate('items')` để nạp danh sách `ItemInfo`. |
| Sao dùng NestJS + MongoDB mà không giống Inventory (Express + SQLite)? | SOA cho phép mỗi service **tự chọn stack** miễn tuân đúng provided interface; binding provider–requester là **động qua broker** (§22.7.6). Đây là tính độc lập/khả tái sử dụng của service (§22.8). |
| `catalogType` là gì? | Enum `CatalogType` (Fig 22.20): **Books, Computers, Home, Toys** — code khai ở `catalog-type.enum.ts`, ràng buộc `enum` ngay trong schema Mongoose. |

---

## 10. Câu kết mạnh

> "Đúng như sách Gomaa Chương 22, Catalog Service của em là một **application service thụ động trong SOA**: expose đúng provided interface `ICatalogService` gồm **2 thao tác** `requestCatalog` (từ message B3) và `requestSelection` (từ message B9, trả B10) — suy ra trực tiếp từ communication diagram của use case **Browse Catalog**. Nó giao tiếp **đồng bộ có trả lời** với Customer Coordinator, và nhờ SOA cho phép binding động, em tự do hiện thực bằng **NestJS + MongoDB** mà vẫn tuân đúng interface — sẵn sàng để Coordinator gọi vào."

---

## Phụ lục — Bản đồ mã nguồn (khi bị hỏi vào code)

- **Interface `ICatalogService`** → `src/catalog/interfaces/icatalog.service.ts` (dòng 5–8)
- **Cài đặt 2 operation** → `src/catalog/catalog.service.ts` (`requestCatalog` dòng 16–18, `requestSelection` dòng 20–26)
- **Provided port (REST)** → `src/catalog/catalog.controller.ts` (`GET /catalog?type=` dòng 9–12, `GET /catalog/item/:id` dòng 14–17)
- **Schema `CatalogInfo` + quan hệ 1..\*** → `src/catalog/schemas/catalog-info.schema.ts` (`items` ref dòng 22–23)
- **Schema `ItemInfo`** → `src/catalog/schemas/item-info.schema.ts`
- **Schema `Supplier`** → `src/catalog/schemas/supplier.schema.ts`
- **Enum `CatalogType`** → `src/catalog/enums/catalog-type.enum.ts`
- **Đăng ký module + model** → `src/catalog/catalog.module.ts`
- **Kết nối MongoDB** → `src/app.module.ts` (`mongodb://localhost:27017/catalog`)
- **Cổng lắng nghe (port 3000)** → `src/main.ts` (`process.env.PORT ?? 3000`)
