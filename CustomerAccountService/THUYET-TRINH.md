# Kịch bản thuyết trình — CustomerAccountService (theo sách Gomaa, Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design*, **Chương 22 — Service-Oriented Architecture Case Study: Online Shopping System** (tr. 424–452).
> Bài này trình bày **Customer Account Service** đúng theo cách sách thiết kế nó, rồi ánh xạ sang bản cài đặt của em (**Spring Boot + JPA + H2**, chạy ở cổng **8081**).

---

## 0. Bố cục 3 phút đầu (nói gì trước)

1. Customer Account Service là **1 trong 6 dịch vụ** của hệ Online Shopping theo SOA — nó là **application service ở Layer 1** (§22.7.2, Fig 22.17), bọc hai entity **Customer** và **CustomerAccount** (Fig 22.10, 22.21).
2. Nó có **hai client**: **Customer Coordinator** (quản lý khách hàng + tài khoản) và **Billing Coordinator** (giữ/trừ/trả tiền cho một đơn hàng).
3. Điểm đặc biệt: service này **đóng luôn vai Credit Card Service** (Fig 22.24 `ICreditCardService`). Em hiện thực `authorizeCharge / commitCharge / abortCharge` bằng **vòng đời HOLD**: `placeHold` (authorize, **M5**) → `captureHold` (commit charge, **S8a**) → `releaseHold` (abort).
4. Vì thế nó là **participant trong two-phase commit** (§22.7.3, Fig 22.15): *authorize* = giữ tiền = vote/prepare; *capture* = commit; *release* = rollback. Chìa khóa là công thức `availableBalance = balance − heldAmount`.
5. Nó cũng là **service DUY NHẤT hiện đã tự đăng ký với Broker** (Service Registration pattern, §22.7.1 & 22.7.3).

---

## 1. Bối cảnh — Customer Account Service nằm ở đâu trong hệ? (§22.1, §22.7.2)

Hệ **Online Shopping System** là ứng dụng phân tán trên Web, thiết kế theo **kiến trúc hướng dịch vụ (SOA)**, có 2 tác nhân: **Customer** và **Supplier**.

Sách chia hệ thành các **service class** (Fig 22.17 & 22.18):

- **Application services:** Catalog Service, Delivery Order Service, Inventory Service, **Customer Account Service**
- **External services:** **Credit Card Service**, Email Service
- **Coordinators** điều phối: Customer Coordinator, Supplier Coordinator, Billing Coordinator
- **User interaction:** Customer Interaction, Supplier Interaction

**Kiến trúc phân lớp (Layers of Abstraction, §22.7.2, Fig 22.17):**

```
Layer 3 — User Layer          : Customer / Supplier Interaction
Layer 2 — Coordination Layer  : Customer / Supplier / BILLING Coordinator
Layer 1 — Service Layer       : Catalog, DeliveryOrder, Inventory, CUSTOMER ACCOUNT, CreditCard, Email
```

> Sách (tr. 442, Layer 1): *"The application services are Catalog Service, Delivery Order Service, Inventory Service, and **Customer Account Service**. The external services are **Credit Card Service** … and Email Service."*

Nguyên tắc phân lớp: lớp trên phụ thuộc lớp dưới, **không ngược lại**. Customer Account Service ở Layer 1 — nó **không tự khởi động giao dịch**, chỉ **trả lời** yêu cầu từ Coordinator (Layer 2).

**Hai client gọi vào service này** (Fig 22.13 & 22.15):

| Client | Nghiệp vụ | Ánh xạ vào code |
|---|---|---|
| **Customer Coordinator** | tạo/xem/sửa khách hàng, tạo tài khoản, nạp/rút tiền | `CustomerController`, `AccountController` (create/deposit/withdraw) |
| **Billing Coordinator** | giữ tiền (authorize) → trừ tiền (confirm billing) → trả tiền (hủy đơn) | `AccountController` nhóm `/holds` |

> Sách (tr. 448): *"Billing Coordinator communicates with four services, of which there are two external services (Credit Card Service and Email Service) and two application services (Delivery Order Service and **Customer Account Service**)."*

---

## 2. Mô hình tĩnh — thực thể Customer & CustomerAccount (§22.7.5, Fig 22.10 & 22.21)

Fig 22.21 quy định service này bọc **hai entity** `Customer` và `CustomerAccount`.

**Điểm mấu chốt để hiểu vì sao service này gánh luôn Credit Card:** trong Fig 22.21, entity **`CustomerAccount` của sách chứa chính thông tin thẻ**:

```
�entity� CustomerAccount           �entity� Customer
accountId : Integer                customerId : Integer
cardId : String                    customerName : String
cardType : String                  address : String
expirationDate : Date              telephoneNumber : String / email : EmailType
```

→ Tức là trong mô hình của Gomaa, **tài khoản khách hàng đã gắn liền với thẻ tín dụng**. Đây là cơ sở để em **gộp Credit Card Service vào Customer Account Service** qua cơ chế *hold* (xem §3.2). Đây là một **quyết định thiết kế có chủ đích**, không phải làm bừa.

**Ánh xạ sang entity JPA thật** (em mở rộng để đủ mô phỏng dòng tiền):

**`Customer`** — `domain/Customer.java`

| Field code | Kiểu | Ghi chú |
|---|---|---|
| `id` | Long | khóa |
| `fullName`, `email`, `phone`, `deliveryAddress` | String | `email` **UNIQUE** (`uk_customer_email`) |
| `status` | `CustomerStatus` = `ACTIVE` / `INACTIVE` | soft delete |

**`CustomerAccount`** — `domain/CustomerAccount.java` (đây là trọng tâm dòng tiền):

| Field code | Kiểu | Ý nghĩa |
|---|---|---|
| `accountNumber` | String | **UNIQUE** (`uk_account_number`), sinh dạng `ACC##########` |
| `balance` | BigDecimal(15,2) | **tổng tiền thực có** |
| `heldAmount` | BigDecimal(15,2) | phần **đang bị giữ** cho đơn đã authorize nhưng chưa giao |
| `currency` | String(3) | mặc định `USD` |
| `status` | `AccountStatus` = `ACTIVE`/`SUSPENDED`/`CLOSED` | |
| `version` | Long (`@Version`) | optimistic lock |

Hai entity phụ trợ em thêm để mô phỏng đúng dòng tiền + đối soát:

- **`AccountHold`** (`domain/AccountHold.java`): một khoản tiền bị giữ cho **một `orderId`** cụ thể. `orderId` **UNIQUE** (`uk_hold_order`) — nền tảng cho tính idempotent. `status` = `HELD` / `CAPTURED` / `RELEASED`.
- **`AccountTransaction`** (`domain/AccountTransaction.java`): sổ cái, mỗi lần đổi số dư ghi 1 dòng kèm `balanceAfter` và `referenceId = orderId`.

### Công thức vàng + bất biến (được ép **bên trong entity**)

```
availableBalance = balance − heldAmount        // phần khách THỰC SỰ tiêu được
balance >= 0,  heldAmount >= 0,  heldAmount <= balance
```

| Thao tác (method entity) | Tiền điều kiện | Hậu điều kiện |
|---|---|---|
| `deposit(a)` | ACTIVE | `balance += a` |
| `withdraw(a)` | `available >= a` | `balance -= a` |
| `hold(a)` | `available >= a` | `heldAmount += a` (**balance không đổi**) |
| `capture(a)` | `heldAmount >= a` | `heldAmount -= a`, `balance -= a` |
| `release(a)` | `heldAmount >= a` | `heldAmount -= a` (**balance không đổi**) |
| `refund(a)` | — | `balance += a` |

> Quy tắc tiền nằm **trong** `CustomerAccount` (rich domain model), không nằm ở service — không ai lách được bằng cách gọi đường khác. `hold()` tự kiểm tra `available >= amount` và tự ném `InsufficientFundsException` (`CustomerAccount.java:102,133`).

---

## 3. Interface dịch vụ — TRỌNG TÂM

Sách: *"Each service has **one provided interface** through which the service operations are accessed … The service operations are designed by considering how each individual service is accessed on the use case–based interaction diagrams"* (§22.7.5, tr. 443). Service này thực chất hiện thực **hai interface trong sách**:

### 3.1 `ICustomerAccountService` (Fig 22.21) — nghiệp vụ tài khoản

Sách (tr. 445–447) và Fig 22.21 cho **3 operations**:

| Operation (Fig 22.21) | Suy ra từ message | Việc làm | Ánh xạ endpoint thật |
|---|---|---|---|
| `requestAccount(in accountId, out account)` | **M3** (Fig 22.13) **và S6** (Fig 22.15) | đọc thông tin tài khoản | `GET /api/v1/accounts/{id}` · `GET /accounts/by-customer/{customerId}` |
| `createAccount(...)` | luồng thay thế của Make Order Request (§22.5.2) | tạo tài khoản | `POST /api/v1/accounts` |
| `updateAccount(...)` | luồng thay thế của Make Order Request | cập nhật | `PUT /api/v1/customers/{id}` (cập nhật hồ sơ) |

> Sách (tr. 445): *"The Customer Account Service has operations to **create a new account, update the account, and read an account** (Figure 22.21) … The **requestAccount** operation corresponds to **message M3** in Figure 22.13 and **message S6** in the Confirm Shipment and Bill Customer communication diagram (Figure 22.15). The createAccount and updateAccount operations correspond to alternatives to the main sequence of Make Order Request."*

Nghĩa là `requestAccount` là thao tác **đọc tài khoản** được cả **Customer Coordinator** (lúc đặt hàng — M3) lẫn **Billing Coordinator** (lúc chốt giao dịch — S6) gọi tới. Em ánh xạ nó thành các endpoint `GET` ở `AccountController`.

### 3.2 `ICreditCardService` (Fig 22.24) — vai Credit Card, hiện thực bằng HOLD lifecycle

Đây là phần **đắt giá nhất** cần nhấn mạnh. Fig 22.24 định nghĩa Credit Card Service với **3 operations**:

```
�interface� ICreditCardService
authorizeCharge (in creditcardId, in amount, out authorizationResponse)   // M5
commitCharge    (in creditcardId, in amount, out chargeResponse)          // S8a
abortCharge     (in creditcardId, in amount, out chargeResponse)          // rollback
```

**Quyết định thiết kế:** vì entity `CustomerAccount` của sách đã chứa thông tin thẻ (§2), em **gộp Credit Card Service vào Customer Account Service** và hiện thực 3 operation đó bằng **vòng đời một `AccountHold`**:

| `ICreditCardService` (Fig 22.24) | Message số | Hiện thực HOLD | Endpoint thật | Trạng thái Hold |
|---|---|---|---|---|
| `authorizeCharge` | **M5** (Fig 22.13, *"equivalent to a Prepare to Commit message"*) | `placeHold(accountId, orderId, amount)` → `heldAmount += amount`, **balance chưa đổi** | `POST /api/v1/accounts/{id}/holds` | `HELD` |
| `commitCharge` | **S8a** (Fig 22.15, *Commit Charge*) | `captureHold(orderId)` → `heldAmount -= amount`, `balance -= amount` | `POST /api/v1/accounts/holds/{orderId}/capture` | `CAPTURED` |
| `abortCharge` | (hủy đơn trước giao) | `releaseHold(orderId)` → `heldAmount -= amount`, **balance không đổi** | `POST /api/v1/accounts/holds/{orderId}/release` | `RELEASED` |

> Sách (tr. 448): *"The Credit Card Service supports one provided interface consisting of two operations — one for **authorizing** a credit card purchase (**message M5** in Make Order Request) and the other for **charging** the credit card (**message S8a** in Confirm Shipment and Bill Customer)."*

**Nhấn mạnh — cả 3 đều idempotent theo `orderId`** (xác nhận trong `AccountService.java`):

- `placeHold`: đầu hàm tra `holds.findWithAccountByOrderId(orderId)`; nếu **đã có** thì **trả lại chính khoản cũ**, KHÔNG giữ thêm lần nữa (`AccountService.java:145–149`).
- `captureHold`: nếu hold đã `CAPTURED` → trả về luôn, không trừ tiền lần hai; nếu đã `RELEASED` → ném `BusinessRuleException` (409) (`AccountService.java:163–171`).
- `releaseHold`: nếu hold đã `RELEASED` → trả về luôn; nếu đã `CAPTURED` → ném `BusinessRuleException` (409) (`AccountService.java:183–191`).

> Vì sao bắt buộc idempotent: Coordinator gọi qua Broker/mạng — request có thể **xử lý xong nhưng phản hồi mất trên đường về**, Coordinator retry. Không idempotent thì mỗi lần mạng chập chờn là khách bị giữ/trừ tiền thêm một lần. Nền tảng kỹ thuật: ràng buộc **UNIQUE trên `order_id`**.

---

## 4. Vai trò trong 2 use case — đọc communication diagram (§22.5.2 & §22.5.4)

### 4.1 Make Order Request (Fig 22.13) — đọc tài khoản + authorize (giữ tiền)

Customer Coordinator điều phối. Các message liên quan tới service này:

```
M3 : Customer Coordinator → Customer Account Service : Account Request   (requestAccount)
M4 : Customer Account Service → Customer Coordinator : Account Info
M5 : Customer Coordinator → Credit Card Service      : Authorize Credit Card Request  (= Prepare to Commit)
M6 : Credit Card Service → Customer Coordinator      : Credit Card Approved           (= Ready to Commit)
```

> Sách (tr. 436): *"**M5**: Customer Coordinator sends the customer's credit card information and charge authorization request to Credit Card Service (this is **equivalent to a Prepare to Commit message**). **M6**: Credit Card Service sends a credit card approval (equivalent to a **Ready to Commit** message)."*

Trong bản cài đặt của em, vì Credit Card đã gộp vào service này:
- **M3/M4** → `GET /accounts/{id}` (đọc tài khoản, `requestAccount`).
- **M5/M6** → `placeHold` → trả `AccountHold{status: HELD}`. Đây chính là **authorize = vote/prepare**: tiền **bị khóa** (`heldAmount += amount`) nhưng `balance` **chưa đổi** — khách chưa bị trừ đồng nào.

### 4.2 Confirm Shipment and Bill Customer (Fig 22.15) — đọc tài khoản + capture/abort

Khi Supplier báo sẵn sàng giao, **Billing Coordinator** điều phối 2PC trên 3 dịch vụ (credit card + delivery order + inventory). Các message liên quan service này:

```
S6 : Billing Coordinator → Customer Account Service : Account Request   (requestAccount)
S7 : Customer Account Service → Billing Coordinator : Account Info
S8a: Billing Coordinator → Credit Card Service      : Commit Charge     (= commit)
```

> Sách (tr. 438–439): *"**S6, S7**: Billing Coordinator sends account request to Customer Account Service, which responds with account information … **S8a**: … Commit Charge message to Credit Card Service."*
> *"The updates to the credit card, delivery order, and inventory are coordinated using the **two-phase commit protocol** (see Chapter 16)."*

Ánh xạ:
- **S6/S7** → `GET /accounts/{id}` (`requestAccount` lần thứ hai, lúc chốt đơn).
- **S8a Commit Charge** → `captureHold(orderId)` → trả `AccountHold{status: CAPTURED}`: **trừ tiền thật** (`heldAmount -= amount`, `balance -= amount`).
- Nếu đơn bị **hủy trước khi giao** → `releaseHold(orderId)` → `RELEASED` (rollback, `balance` giữ nguyên).

---

## 5. Two-Phase Commit — vì sao tách authorize / capture / release (§22.7.3)

Sách liệt kê 2PC là một **Architectural Communication Pattern**:

> Sách (tr. 443): *"**Two-Phase Commit.** This pattern is used to ensure that updates to **inventory, credit card, and delivery order** are **atomic**, so **either all updates are committed or all are aborted**."*

**Câu chuyện phải kể:**

> "Khi đặt hàng, ta **chưa trừ tiền** ngay mà chỉ **giữ tiền** (`placeHold` = *authorize* = vote/prepare). Billing Coordinator đợi tất cả participant (credit card / delivery order / inventory) 'vote yes'. Nếu mọi bên OK → **`captureHold`** (trừ tiền thật = *commit*). Nếu bất kỳ bên nào từ chối → **`releaseHold`** (nhả tiền giữ, số dư về nguyên trạng = *rollback*). Nhờ tách 'giữ tiền' và 'trừ thật', **rollback rất sạch** — vì `hold` chưa bao giờ đụng `balance`."

Vai trò của Customer Account Service ở đây là **participant thụ động**: nó chỉ *vote* (hold thành công/thất bại) và thực thi lệnh capture/release của Coordinator, **không tự quyết** kết cục giao dịch. Đây là ánh xạ trực tiếp của công thức `availableBalance = balance − heldAmount`:

| Giai đoạn 2PC | Method | Ảnh hưởng số dư |
|---|---|---|
| Prepare / vote | `placeHold` → `hold()` | `heldAmount += a` (available giảm) |
| Commit | `captureHold` → `capture()` | `balance -= a`, `heldAmount -= a` |
| Rollback | `releaseHold` → `release()` | `heldAmount -= a` (available hồi lại) |

---

## 6. Điểm kỹ thuật đắt giá — chống race condition (khóa bi quan)

Đây là chỗ ghi điểm về cài đặt. Mọi thao tác đổi tiền đều đọc tài khoản qua **`findByIdForUpdate`** với `@Lock(PESSIMISTIC_WRITE)` (`CustomerAccountRepository.java:41–43`), gọi từ `AccountService.lock()` (`AccountService.java:203`).

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select a from CustomerAccount a where a.id = :id")
Optional<CustomerAccount> findByIdForUpdate(@Param("id") Long id);
```

> "Nếu KHÔNG khóa dòng: hai đơn đặt cùng lúc trên cùng tài khoản có thể **cùng đọc `available = 700`**, cùng thấy đủ tiền, cùng giữ 400 → tổng giữ **800 > số dư**. Đó là lỗi kinh điển *lost update*. Với khóa `PESSIMISTIC_WRITE`, request thứ hai **chờ**, rồi đọc lại số dư **đã cập nhật** → nó thấy đúng phần còn lại. Tiền là dữ liệu không cho phép retry khi xung đột, nên khóa bi quan phù hợp hơn khóa lạc quan."

Ngoài ra `@Version` trên `CustomerAccount` cho optimistic lock; toàn bộ ghi bọc trong `@Transactional` — nếu `hold()` ném lỗi thì **rollback sạch**: không tạo `AccountHold`, không ghi sổ, `heldAmount` giữ nguyên.

---

## 7. Xử lý lỗi = ngữ nghĩa "vote" của participant (`GlobalExceptionHandler`)

Coordinator ra quyết định dựa trên **mã HTTP**, không phải đọc chuỗi lỗi:

| Exception domain | HTTP | `error` | Ý nghĩa với Coordinator |
|---|---|---|---|
| `InsufficientFundsException` | **422** | `INSUFFICIENT_FUNDS` | **vote abort** — khách không đủ tiền → Billing Coordinator **từ chối đơn** |
| `NotFoundException` | 404 | `NOT_FOUND` | không có khách/tài khoản/đơn → lỗi hệ thống, dừng |
| `BusinessRuleException` | 409 | `BUSINESS_RULE_VIOLATED` | trạng thái đơn lệch (vd đơn đã hủy mà đòi capture) → đối soát |
| `DuplicateException` | 409 | `DUPLICATE` | email đã tồn tại |
| `MethodArgumentNotValidException` | 400 | `VALIDATION_FAILED` | dữ liệu sai (amount ≤ 0, orderId rỗng) |

`422 INSUFFICIENT_FUNDS` còn trả kèm `{accountNumber, available, requested}` để Coordinator biết còn thiếu bao nhiêu (`GlobalExceptionHandler.java:29`).

**Các luồng thay thế đã hiện thực** (khớp `docs/ALTERNATIVE-FLOWS.md`, có test chứng minh):
- **A1 — không đủ tiền** → 422; `heldAmount` vẫn 0 (rollback sạch). Biến thể A1-b: `balance=250, heldAmount=200 → available=50`, `placeHold(100)` vẫn bị **422** dù `balance > amount`, vì 200 đã bị khóa cho đơn trước → *hai đơn không tiêu chung một khoản tiền*.
- **A2 — retry cùng `orderId`** → 200 + khoản giữ cũ, không giữ tiền hai lần.
- **A5 — hai đơn đồng thời** → nhờ khóa dòng, đúng 1 thành công, 1 bị 422.
- **B2 — capture đơn đã `RELEASED`** → 409. **C2 — release đơn đã `CAPTURED`** → 409 (phải dùng `refund`).

---

## 8. Tự đăng ký Broker — Service Registration pattern (§22.7.1 & 22.7.3)

> Sách (tr. 441): *"In service-oriented architectures, services **register their service name and location with a broker**. Clients can then discover new services by using the **Service Discovery pattern (yellow pages)** to query the broker."* — và tr. 443 (**Broker Handle**): *"Each service registers service information, including service name, service description and location with the broker."*

Đây là **service duy nhất hiện đã tự đăng ký với Broker**. Cơ chế (`broker/`):

- **Đăng ký** khi Tomcat sẵn sàng (`BrokerRegistrar.onWebServerReady`) — gửi `ServiceRegistration{serviceId, serviceName, version, host, port, baseUrl, healthUrl, operations[]}` tới `POST /registry/services` (`BrokerClient.java:45`).
- **Danh sách 14 operations** khai báo ở `BrokerRegistrar.java:29`: `createCustomer, getCustomer, updateCustomer, deactivateCustomer, createAccount, getAccount, getAccountsByCustomer, deposit, withdraw, refund, placeHold, captureHold, releaseHold, listTransactions` — đây là "trang vàng" (yellow pages) để Coordinator tra cứu.
- **Heartbeat** mỗi 30s (`PUT /registry/services/{serviceId}/heartbeat`). Nếu heartbeat trả lỗi/404 (Broker vừa restart, quên mất service) → `registered = false` → **tự đăng ký lại** ở tick kế tiếp (`BrokerRegistrar.java:55–68`).
- **Hủy đăng ký** khi tắt (`@PreDestroy` → `DELETE /registry/services/{serviceId}`).
- **Broker chết cũng không sao:** mọi lời gọi Broker có timeout và **không ném ra ngoài** (`BrokerClient` bắt hết `RestClientException`, chỉ ghi WARN). API vẫn phục vụ bình thường → tránh Broker thành single point of failure, và thứ tự khởi động khi demo không còn quan trọng.

---

## 9. Ánh xạ Sách → Code (slide tổng kết)

| Khái niệm trong sách (Ch 22) | Nơi trong code |
|---|---|
| Entity `Customer`, `CustomerAccount` (Fig 22.10, 22.21) | `domain/Customer.java`, `domain/CustomerAccount.java` |
| Bất biến tiền `available = balance − heldAmount` | `CustomerAccount.getAvailableBalance()` + `requireAvailable()` |
| `ICustomerAccountService` — `requestAccount` (M3/S6) | `AccountController` các `GET /accounts/...` |
| `ICustomerAccountService` — `createAccount` / `updateAccount` | `AccountController.create`, `CustomerController.update` |
| `ICreditCardService.authorizeCharge` (M5, Prepare to Commit) | `AccountService.placeHold` → `POST /accounts/{id}/holds` |
| `ICreditCardService.commitCharge` (S8a) | `AccountService.captureHold` → `POST /accounts/holds/{orderId}/capture` |
| `ICreditCardService.abortCharge` (rollback) | `AccountService.releaseHold` → `POST /accounts/holds/{orderId}/release` |
| Two-phase commit participant (§22.7.3) | `hold/capture/release` trên `CustomerAccount` |
| Idempotent theo `orderId` | UNIQUE `uk_hold_order` + logic tra hold ở `AccountService` |
| Chống race condition | `findByIdForUpdate` (`PESSIMISTIC_WRITE`) |
| Service Registration / Broker Handle | `broker/BrokerRegistrar`, `broker/BrokerClient` |
| Provided interface qua 1 port | REST controller `/api/v1/...` |

---

## 10. DEMO trực tiếp (cổng 8081)

```bash
cd CustomerAccountService
./mvnw spring-boot:run       # Windows: mvnw.cmd spring-boot:run
# Service: http://localhost:8081 | Swagger: /swagger-ui.html | H2: /h2-console
# Profile 'demo' nạp sẵn: KH#1 Minh (balance 1000, account id 1), KH#2 Huy (balance 250, account id 2)
```

**Luồng chính (Make Order → Confirm Shipment): authorize → capture**

```bash
# M5 authorize: giu 300 cho don ORD-001  → tra HoldView{status:"HELD"}, balance van 1000, held=300
curl -X POST http://localhost:8081/api/v1/accounts/1/holds \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"ORD-001\",\"amount\":300,\"description\":\"Don 2 quyen sach\"}"

# xem tai khoan: available = 700
curl http://localhost:8081/api/v1/accounts/1

# S8a commit charge: hang da giao, tru tien that → status "CAPTURED", balance 700, held 0
curl -X POST http://localhost:8081/api/v1/accounts/holds/ORD-001/capture
```

**Luồng thay thế — hủy đơn: authorize → release** (rollback, "balance không đổi")

```bash
curl -X POST http://localhost:8081/api/v1/accounts/1/holds \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"ORD-002\",\"amount\":200}"
curl -X POST http://localhost:8081/api/v1/accounts/holds/ORD-002/release
# → status "RELEASED"; balance van 1000, held ve 0 (dung nghia rollback)
```

**Demo không đủ tiền (422, vote abort):** giữ 999 trên tài khoản KH#2 (chỉ có 250)

```bash
curl -i -X POST http://localhost:8081/api/v1/accounts/2/holds \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"ORD-003\",\"amount\":999}"
# → HTTP 422 INSUFFICIENT_FUNDS {available:250, requested:999}
```

**Demo idempotent (A2):** gọi lại `capture ORD-001` lần hai → vẫn `CAPTURED`, **không trừ tiền lần nữa**.
**Demo sai luồng (C2):** `release ORD-001` sau khi đã capture → **409 BUSINESS_RULE_VIOLATED**.

---

## 11. Câu hỏi có thể bị hỏi (chuẩn bị sẵn)

| Câu hỏi | Trả lời (bám sách) |
|---|---|
| Customer Account Service làm gì trong hệ? | Application service Layer 1 (§22.7.2), bọc entity Customer + CustomerAccount; cung cấp `ICustomerAccountService` (Fig 22.21), được Customer Coordinator và Billing Coordinator gọi. |
| Vì sao service này lại làm Credit Card? | Fig 22.21: entity `CustomerAccount` của sách đã chứa `cardId/cardType/expirationDate`. Em gộp `ICreditCardService` (Fig 22.24) vào, hiện thực `authorizeCharge/commitCharge/abortCharge` bằng vòng đời hold. Đây là quyết định thiết kế có chủ đích. |
| `placeHold` khác `captureHold` chỗ nào? | `placeHold` = **M5 authorize = prepare to commit**: chỉ khóa tiền (`heldAmount += a`), balance chưa đổi. `captureHold` = **S8a commit charge**: trừ tiền thật (`balance -= a`). |
| Two-phase commit là gì, ai điều phối? | Prepare→Commit/Abort để cập nhật credit card + delivery order + inventory **atomic** (§22.7.3). Billing Coordinator điều phối; service này là participant, chỉ vote + thực thi. |
| Vì sao release không đụng `balance`? | `hold` chỉ tăng `heldAmount`, chưa từng trừ `balance`. Release chỉ trả lại phần giữ → rollback sạch. |
| Tiền đang giữ có tiêu được không? | Không. `available = balance − heldAmount`. `balance=250, held=200` thì `hold(100)` vẫn bị 422 dù balance > 100. |
| Chống 2 đơn cùng lúc? | `findByIdForUpdate` (`PESSIMISTIC_WRITE`) tuần tự hóa 2 request; đơn thứ hai đọc số dư đã cập nhật. Không read-then-write. |
| Retry của Coordinator có an toàn không? | Có. Cả 3 thao tác idempotent theo `orderId` (UNIQUE `uk_hold_order`). Gọi lại không giữ/trừ/trả hai lần. |
| Broker chết thì sao? | Service vẫn phục vụ API; lời gọi Broker có timeout, chỉ ghi WARN, tự đăng ký lại ở heartbeat sau (§22.7.1). |
| Sao dùng Spring Boot + H2 mà khác InventoryService (Express)? | SOA cho phép mỗi service tự chọn stack, miễn tuân đúng provided interface; binding provider–requester là **động** qua Broker (§22.7.6). |

---

## 12. Câu kết mạnh

> "Đúng như sách Gomaa Chương 22, Customer Account Service của em là **application service Layer 1** bọc hai entity Customer và CustomerAccount, cung cấp `ICustomerAccountService` (`requestAccount` từ M3/S6, `createAccount`, `updateAccount`). Đặc biệt nó **gánh luôn vai Credit Card Service** (Fig 22.24) qua vòng đời hold — `placeHold` là **authorize/M5 = prepare to commit**, `captureHold` là **commit charge/S8a**, `releaseHold` là **abort** — nên nó đóng đúng vai **participant trong two-phase commit** (§22.7.3), với ba thao tác **idempotent theo orderId** và số dư luôn nhất quán nhờ `available = balance − heldAmount` + khóa bi quan. Nó cũng là service duy nhất **tự đăng ký với Broker** theo Service Registration pattern — sẵn sàng để Coordinator khám phá và gọi vào."

---

## Phụ lục — Bản đồ mã nguồn (khi bị hỏi vào code)

- **Entity + bất biến tiền** → `domain/CustomerAccount.java` (`getAvailableBalance` 86, `hold` 102, `capture` 109, `release` 118, `requireAvailable` 133)
- **Vòng đời hold** → `domain/AccountHold.java` (`markCaptured` 63, `markReleased` 68; UNIQUE `order_id` dòng 25) + `domain/HoldStatus.java` (HELD/CAPTURED/RELEASED)
- **Logic Credit Card / 2PC** → `service/AccountService.java` (`placeHold` 145, `captureHold` 163, `releaseHold` 183, `lock` 203)
- **Khóa bi quan** → `repository/CustomerAccountRepository.java` (`findByIdForUpdate` 41–43)
- **Endpoint** → `web/AccountController.java` (`placeHold` 87, `capture` 93, `release` 99) + `web/CustomerController.java`
- **Map lỗi → HTTP** → `web/GlobalExceptionHandler.java` (422 `INSUFFICIENT_FUNDS` 29)
- **DTO** → `web/dto/AccountRequests.java` (`PlaceHold`), `web/dto/Responses.java` (`HoldView`, `AccountView`)
- **Đăng ký Broker** → `broker/BrokerRegistrar.java` (operations 29, heartbeat 55, attemptRegister 77) + `broker/BrokerClient.java` (register 45, heartbeat 60, lookup 89)
- **Dữ liệu demo** → `config/DemoDataSeeder.java` (Minh 1000 / Huy 250, dòng 41–42)
- **Cấu hình** → `src/main/resources/application.properties` (port 8081, broker.base-url 8080)
