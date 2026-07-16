# Thiết kế CustomerAccountService

**Online Shopping System — SWD392**
Người thực hiện: **Nguyễn Thế Minh**

> Tài liệu này mô tả thiết kế của service `CustomerAccountService`, bám theo phương pháp COMET
> (Gomaa) như trong Figure 22.10 và Figure 22.11.

**Mục lục**

1. [Vị trí trong kiến trúc](#1-vị-trí-trong-kiến-trúc)
2. [Mô hình tĩnh — Class diagram](#2-mô-hình-tĩnh--class-diagram)
3. [Đặc tả giao diện service](#3-đặc-tả-giao-diện-service)
4. [Mô hình động — Sequence diagram](#4-mô-hình-động--sequence-diagram)
5. [State machine của AccountHold](#5-state-machine-của-accounthold)
6. [Lược đồ CSDL](#6-lược-đồ-csdl)
7. [Các quyết định thiết kế và lý do](#7-các-quyết-định-thiết-kế-và-lý-do)
8. [Truy vết use case](#8-truy-vết-use-case)

---

## 1. Vị trí trong kiến trúc

Theo Figure 22.11, hệ thống được cấu trúc thành ba loại lớp: `«user interaction»`, `«coordinator»`
và `«service»`. `CustomerAccountService` là một lớp **`«service»`**.

Điều đó quy định rất rõ nó được phép làm gì:

| Đặc điểm của lớp `«service»` | Hệ quả với CustomerAccountService |
|---|---|
| Không khởi xướng giao tiếp, chỉ **trả lời** yêu cầu | Nó không bao giờ tự gọi CatalogService hay InventoryService |
| Không giữ luồng nghiệp vụ (workflow) | Nó **không** biết một đơn hàng đang ở bước nào — Billing Coordinator biết |
| Sở hữu và bảo vệ dữ liệu của mình | Chỉ nó được ghi vào `Customer` và `CustomerAccount` |

```mermaid
flowchart TB
    subgraph UI["«user interaction»"]
        CI[Customer Interaction]
    end
    subgraph CO["«coordinator»"]
        CC[Customer Coordinator]
        BC[Billing Coordinator]
    end
    subgraph SV["«service»"]
        CAS["<b>CustomerAccountService</b><br/>(phần của Minh)"]
        DOS[DeliveryOrderService]
        CATS[CatalogService]
        INVS[InventoryService]
    end
    BR[["Broker<br/>(service registry)"]]

    CI --> CC
    CI --> BC
    CC -->|"tạo/xem/sửa khách hàng<br/>và tài khoản"| CAS
    BC -->|"authorize / confirm billing /<br/>hủy đơn"| CAS
    BC --> DOS
    CAS -.->|"đăng ký + heartbeat"| BR
    DOS -.-> BR
    CATS -.-> BR
    INVS -.-> BR

    style CAS fill:#cfe3ff,stroke:#2b6cb0,stroke-width:2px
```

**Hai client của service này:**

- **Customer Coordinator** — nghiệp vụ về khách hàng: đăng ký, xem, sửa thông tin, tạo tài khoản, nạp tiền.
- **Billing Coordinator** — nghiệp vụ về tiền của một đơn hàng: giữ tiền khi đặt hàng, trừ tiền khi giao
  hàng, trả lại tiền khi hủy đơn.

---

## 2. Mô hình tĩnh — Class diagram

Figure 22.10 quy định service này bọc hai entity `Customer` và `CustomerAccount`. Thiết kế bổ sung thêm
hai entity **`AccountHold`** và **`AccountTransaction`** — lý do nêu ở [mục 7](#7-các-quyết-định-thiết-kế-và-lý-do).

```mermaid
classDiagram
    class AccountService {
        <<service>>
        +createAccount(customerId, initialBalance) CustomerAccount
        +getById(accountId) CustomerAccount
        +deposit(accountId, amount) CustomerAccount
        +withdraw(accountId, amount) CustomerAccount
        +refund(accountId, amount) CustomerAccount
        +placeHold(accountId, orderId, amount) AccountHold
        +captureHold(orderId) AccountHold
        +releaseHold(orderId) AccountHold
        +findTransactions(accountId) List~AccountTransaction~
    }

    class CustomerService {
        <<service>>
        +create(fullName, email, phone, address) Customer
        +getById(id) Customer
        +getByEmail(email) Customer
        +update(id, data) Customer
        +deactivate(id) Customer
    }

    class Customer {
        <<entity>>
        -Long id
        -String fullName
        -String email
        -String phone
        -String deliveryAddress
        -CustomerStatus status
        +isActive() boolean
    }

    class CustomerAccount {
        <<entity>>
        -Long id
        -String accountNumber
        -BigDecimal balance
        -BigDecimal heldAmount
        -String currency
        -AccountStatus status
        -Long version
        +getAvailableBalance() BigDecimal
        +deposit(amount)
        +withdraw(amount)
        +hold(amount)
        +capture(amount)
        +release(amount)
        +refund(amount)
    }

    class AccountHold {
        <<entity>>
        -Long id
        -String orderId
        -BigDecimal amount
        -HoldStatus status
        -Instant settledAt
        +markCaptured()
        +markReleased()
    }

    class AccountTransaction {
        <<entity>>
        -Long id
        -TransactionType type
        -BigDecimal amount
        -BigDecimal balanceAfter
        -String referenceId
        -Instant createdAt
    }

    class HoldStatus {
        <<enumeration>>
        HELD
        CAPTURED
        RELEASED
    }

    class TransactionType {
        <<enumeration>>
        DEPOSIT
        WITHDRAW
        HOLD
        CAPTURE
        RELEASE
        REFUND
    }

    CustomerService ..> Customer : quản lý
    AccountService ..> CustomerAccount : quản lý
    AccountService ..> AccountHold : tạo/kết toán
    AccountService ..> AccountTransaction : ghi sổ
    Customer "1" --> "0..1" CustomerAccount : sở hữu
    CustomerAccount "1" --> "*" AccountHold : bị giữ tiền bởi
    CustomerAccount "1" --> "*" AccountTransaction : ghi sổ
    AccountHold --> HoldStatus
    AccountTransaction --> TransactionType
```

### Bất biến của `CustomerAccount`

Đây là những điều **luôn đúng** với một tài khoản, và chúng được bảo vệ **bên trong entity** chứ không
phải ở tầng service:

```
balance    >= 0
heldAmount >= 0
heldAmount <= balance
availableBalance = balance - heldAmount     // phần khách thực sự tiêu được
```

| Thao tác | Tiền điều kiện | Hậu điều kiện |
|---|---|---|
| `deposit(a)` | tài khoản ACTIVE | `balance += a` |
| `withdraw(a)` | `available >= a` | `balance -= a` |
| `hold(a)` | `available >= a` | `heldAmount += a` (balance **không đổi**) |
| `capture(a)` | `heldAmount >= a` | `heldAmount -= a`, `balance -= a` |
| `release(a)` | `heldAmount >= a` | `heldAmount -= a` (balance **không đổi**) |
| `refund(a)` | — | `balance += a` |

---

## 3. Đặc tả giao diện service

### 3.1 Nghiệp vụ dành cho Customer Coordinator

| Operation | Tham số vào | Trả về | Ngoại lệ |
|---|---|---|---|
| `createCustomer` | fullName, email, phone, deliveryAddress | Customer | `DUPLICATE` (email đã tồn tại) |
| `getCustomer` | id \| email | Customer | `NOT_FOUND` |
| `updateCustomer` | id, fullName, phone, address | Customer | `NOT_FOUND` |
| `deactivateCustomer` | id | Customer | `NOT_FOUND`, `BUSINESS_RULE_VIOLATED` (còn tiền đang bị giữ) |
| `createAccount` | customerId, initialBalance | CustomerAccount | `NOT_FOUND`, `BUSINESS_RULE_VIOLATED` (đã có tài khoản) |
| `deposit` / `withdraw` | accountId, amount | CustomerAccount | `INSUFFICIENT_FUNDS` (khi rút) |

### 3.2 Nghiệp vụ dành cho Billing Coordinator

| Operation | Tham số vào | Trả về | Ngoại lệ |
|---|---|---|---|
| `placeHold` | accountId, **orderId**, amount | AccountHold (HELD) | `INSUFFICIENT_FUNDS`, `NOT_FOUND` |
| `captureHold` | **orderId** | AccountHold (CAPTURED) | `NOT_FOUND`, `BUSINESS_RULE_VIOLATED` (đơn đã hủy) |
| `releaseHold` | **orderId** | AccountHold (RELEASED) | `NOT_FOUND`, `BUSINESS_RULE_VIOLATED` (đơn đã trừ tiền) |
| `refund` | accountId, amount | CustomerAccount | `NOT_FOUND` |

**Cả ba thao tác trên đều idempotent theo `orderId`.**

### 3.3 Ánh xạ ngoại lệ sang mã HTTP

Coordinator ra quyết định dựa trên **mã trả về**, không phải bằng cách đọc chuỗi lỗi:

| Mã HTTP | `error` | Billing Coordinator làm gì |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Lỗi lập trình, sửa request |
| 404 | `NOT_FOUND` | Dừng, báo lỗi hệ thống |
| 409 | `BUSINESS_RULE_VIOLATED` | Trạng thái đơn hàng bị lệch, cần đối soát |
| 409 | `DUPLICATE` | Báo "email đã tồn tại" cho người dùng |
| **422** | **`INSUFFICIENT_FUNDS`** | **Từ chối đơn hàng, báo khách nạp thêm tiền** |

---

## 4. Mô hình động — Sequence diagram

### 4.1 Đặt hàng — Billing Coordinator authorize (luồng thành công)

Đây là kịch bản chính. Chú ý: **tiền chỉ bị khóa, `balance` chưa đổi.**

```mermaid
sequenceDiagram
    actor KH as Customer
    participant CI as «user interaction»<br/>Customer Interaction
    participant BC as «coordinator»<br/>Billing Coordinator
    participant CAS as «service»<br/>CustomerAccountService
    participant ACC as «entity»<br/>CustomerAccount
    participant DOS as «service»<br/>DeliveryOrderService

    KH->>CI: Xác nhận mua hàng
    CI->>BC: checkout(customerId, tổng tiền)
    BC->>DOS: createOrder(...) → orderId
    DOS-->>BC: orderId = ORD-001

    Note over BC,CAS: Authorize: giữ tiền trước khi đơn được xử lý
    BC->>CAS: placeHold(accountId, "ORD-001", 300)
    activate CAS
    CAS->>ACC: khóa dòng (PESSIMISTIC_WRITE)
    CAS->>ACC: hold(300)
    ACC->>ACC: kiểm tra available >= 300
    ACC->>ACC: heldAmount += 300
    Note right of ACC: balance = 1000 (không đổi)<br/>heldAmount = 300<br/>available = 700
    CAS->>CAS: lưu AccountHold(ORD-001, HELD)
    CAS->>CAS: ghi sổ AccountTransaction(HOLD)
    CAS-->>BC: AccountHold{status: HELD}
    deactivate CAS

    BC-->>CI: Đặt hàng thành công
    CI-->>KH: Hiển thị xác nhận đơn hàng
```

### 4.2 Đặt hàng — không đủ tiền (luồng thay thế)

```mermaid
sequenceDiagram
    participant BC as Billing Coordinator
    participant CAS as CustomerAccountService
    participant ACC as CustomerAccount

    BC->>CAS: placeHold(accountId, "ORD-003", 999)
    activate CAS
    CAS->>ACC: hold(999)
    ACC->>ACC: available (250) < 999
    ACC--xCAS: InsufficientFundsException
    Note over CAS: Transaction rollback:<br/>heldAmount KHÔNG đổi,<br/>không ghi sổ, không tạo Hold
    CAS-->>BC: 422 INSUFFICIENT_FUNDS<br/>{available: 250, requested: 999}
    deactivate CAS
    Note over BC: Từ chối đơn hàng,<br/>yêu cầu khách nạp thêm tiền
```

### 4.3 Giao hàng — confirm billing (trừ tiền thật)

Trong sách, khách hàng chỉ **thực sự bị tính tiền khi hàng được giao**. Đó chính là bước `capture`.

```mermaid
sequenceDiagram
    participant DOS as DeliveryOrderService
    participant BC as Billing Coordinator
    participant CAS as CustomerAccountService
    participant ACC as CustomerAccount

    DOS->>BC: orderShipped("ORD-001")
    BC->>CAS: captureHold("ORD-001")
    activate CAS
    CAS->>CAS: tìm AccountHold theo orderId
    alt hold đang HELD
        CAS->>ACC: khóa dòng + capture(300)
        ACC->>ACC: heldAmount -= 300<br/>balance -= 300
        Note right of ACC: balance = 700<br/>heldAmount = 0<br/>available = 700
        CAS->>CAS: hold.markCaptured()
        CAS->>CAS: ghi sổ AccountTransaction(CAPTURE)
        CAS-->>BC: AccountHold{status: CAPTURED}
    else hold đã CAPTURED (gọi lại lần hai)
        CAS-->>BC: AccountHold{status: CAPTURED}
        Note over CAS: Idempotent — KHÔNG trừ tiền lần nữa
    else hold đã RELEASED
        CAS-->>BC: 409 BUSINESS_RULE_VIOLATED
    end
    deactivate CAS
```

### 4.4 Hủy đơn hàng — trả lại tiền

```mermaid
sequenceDiagram
    actor KH as Customer
    participant BC as Billing Coordinator
    participant CAS as CustomerAccountService
    participant ACC as CustomerAccount

    KH->>BC: Hủy đơn ORD-002
    BC->>CAS: releaseHold("ORD-002")
    activate CAS
    alt hold đang HELD
        CAS->>ACC: khóa dòng + release(200)
        ACC->>ACC: heldAmount -= 200
        Note right of ACC: balance không đổi,<br/>tiền được "mở khóa" cho khách
        CAS->>CAS: hold.markReleased()
        CAS->>CAS: ghi sổ AccountTransaction(RELEASE)
        CAS-->>BC: AccountHold{status: RELEASED}
    else hold đã CAPTURED (hàng đã giao rồi)
        CAS-->>BC: 409 BUSINESS_RULE_VIOLATED
        Note over BC: Phải dùng nghiệp vụ hoàn tiền (refund),<br/>không phải release
    end
    deactivate CAS
```

### 4.5 Đăng ký với Broker (Service Registration pattern)

```mermaid
sequenceDiagram
    participant CAS as CustomerAccountService
    participant BR as Broker
    participant BC as Billing Coordinator

    Note over CAS: Khởi động, Tomcat sẵn sàng ở cổng 8081
    CAS->>BR: POST /registry/services<br/>{serviceName, baseUrl, operations[]}
    alt Broker đang chạy
        BR-->>CAS: 200 OK
        Note over CAS: registered = true
    else Broker chưa bật
        BR--xCAS: Connection refused
        Note over CAS: Chỉ ghi WARN.<br/>API vẫn phục vụ bình thường,<br/>thử đăng ký lại ở heartbeat kế tiếp
    end

    loop mỗi 30 giây
        CAS->>BR: PUT /registry/services/{serviceId}/heartbeat
    end

    Note over BC: Cần gọi CustomerAccountService
    BC->>BR: GET /registry/services/CustomerAccountService
    BR-->>BC: [{baseUrl: "http://localhost:8081", status: "UP"}]
    BC->>CAS: POST /api/v1/accounts/1/holds

    Note over CAS: Tắt service
    CAS->>BR: DELETE /registry/services/{serviceId}
```

---

## 5. State machine của AccountHold

Mỗi đơn hàng có đúng một `AccountHold`. Trạng thái của nó chính là trạng thái thanh toán của đơn hàng đó.

```mermaid
stateDiagram-v2
    [*] --> HELD : placeHold(orderId, amount)<br/>Billing Coordinator authorize

    HELD --> CAPTURED : captureHold()<br/>hàng đã giao → trừ tiền thật
    HELD --> RELEASED : releaseHold()<br/>đơn bị hủy → trả lại tiền

    HELD --> HELD : placeHold() lần hai<br/>(idempotent, không giữ thêm)
    CAPTURED --> CAPTURED : captureHold() lần hai<br/>(idempotent, không trừ thêm)
    RELEASED --> RELEASED : releaseHold() lần hai<br/>(idempotent)

    CAPTURED --> [*]
    RELEASED --> [*]

    note right of CAPTURED
        releaseHold() ở đây bị từ chối (409).
        Muốn trả tiền phải dùng refund().
    end note

    note right of RELEASED
        captureHold() ở đây bị từ chối (409).
    end note
```

---

## 6. Lược đồ CSDL

```mermaid
erDiagram
    CUSTOMERS ||--o| CUSTOMER_ACCOUNTS : "sở hữu"
    CUSTOMER_ACCOUNTS ||--o{ ACCOUNT_HOLDS : "bị giữ tiền bởi"
    CUSTOMER_ACCOUNTS ||--o{ ACCOUNT_TRANSACTIONS : "ghi sổ"

    CUSTOMERS {
        bigint id PK
        varchar full_name
        varchar email UK
        varchar phone
        varchar delivery_address
        varchar status
        timestamp created_at
    }
    CUSTOMER_ACCOUNTS {
        bigint id PK
        varchar account_number UK
        bigint customer_id FK
        decimal balance
        decimal held_amount
        varchar currency
        varchar status
        bigint version "optimistic lock"
    }
    ACCOUNT_HOLDS {
        bigint id PK
        bigint account_id FK
        varchar order_id UK "khóa idempotency"
        decimal amount
        varchar status "HELD|CAPTURED|RELEASED"
        timestamp settled_at
    }
    ACCOUNT_TRANSACTIONS {
        bigint id PK
        bigint account_id FK
        varchar type
        decimal amount
        decimal balance_after
        varchar reference_id "= order_id"
        timestamp created_at
    }
```

Hai ràng buộc quan trọng nhất:

- `account_holds.order_id` **UNIQUE** → nền tảng của tính idempotent.
- `customer_accounts.version` → optimistic lock, kết hợp với khóa bi quan khi ghi.

---

## 7. Các quyết định thiết kế và lý do

### QĐ-1: Giữ tiền hai bước (hold → capture) thay vì trừ thẳng

**Vấn đề.** Nếu trừ tiền ngay lúc đặt hàng, khi đơn bị hủy hoặc hết hàng ta phải hoàn tiền — sổ sách
sinh ra hai bút toán ngược nhau cho một đơn không hề xảy ra.

**Quyết định.** Lúc đặt hàng chỉ **khóa** tiền (`heldAmount`), chỉ trừ thật khi hàng đã giao.

**Lý do.** Khớp đúng nghiệp vụ trong sách — khách chỉ bị tính tiền khi hàng được giao. Đồng thời phản ánh
đúng cách thẻ tín dụng hoạt động (authorize rồi mới capture), nên sau này ghép với `CreditCardService`
của hệ thống sẽ không phải sửa mô hình.

### QĐ-2: Bất biến về tiền nằm trong entity, không nằm trong service

**Quyết định.** `CustomerAccount.hold()` tự kiểm tra `available >= amount` và tự ném `InsufficientFundsException`.

**Lý do.** Không ai có thể lách qua quy tắc bằng cách gọi một đường khác. Nếu để việc kiểm tra ở tầng
service, mỗi chỗ gọi mới lại phải nhớ kiểm tra lại — sớm muộn sẽ có chỗ quên. Đây là mô hình domain
"béo" (rich domain model), đúng tinh thần lớp `«entity»` của COMET.

### QĐ-3: Idempotent theo `orderId`

**Vấn đề.** Broker/coordinator gọi qua mạng — request có thể bị timeout rồi retry, dù lần đầu **đã** thành
công. Nếu không xử lý, khách sẽ bị giữ tiền (hoặc trừ tiền) hai lần cho cùng một đơn.

**Quyết định.** `order_id` là UNIQUE. `placeHold` gặp `orderId` đã có thì trả về chính khoản giữ cũ.
`captureHold` / `releaseHold` gặp trạng thái đã đúng đích thì trả về luôn, không làm gì thêm.

**Lý do.** Đây là điều kiện bắt buộc để hệ phân tán an toàn: **retry phải vô hại**.

### QĐ-4: Khóa bi quan khi đổi số dư

**Vấn đề.** Hai đơn hàng đặt cùng lúc trên cùng tài khoản có thể cùng đọc `available = 700`, rồi cả hai
cùng giữ 500 → tổng giữ 1000 > số dư. Đây là lỗi kinh điển (race condition / lost update).

**Quyết định.** Mọi thao tác đổi tiền đều đọc tài khoản qua `findByIdForUpdate` (`PESSIMISTIC_WRITE`).

**Lý do.** Hai request bị tuần tự hóa ở tầng CSDL: request thứ hai chờ, và khi tới lượt nó **đọc được số
dư đã cập nhật**. Đây là kiểu dữ liệu (tiền) mà việc thử lại khi xung đột không chấp nhận được, nên khóa
bi quan phù hợp hơn khóa lạc quan.

### QĐ-5: Có sổ cái `AccountTransaction`

**Quyết định.** Mọi thay đổi số dư đều ghi một dòng, kèm `balanceAfter` và `referenceId = orderId`.

**Lý do.** Khi có tranh chấp ("tôi bị trừ tiền hai lần"), phải trả lời được **vì sao số dư ra con số hiện
tại**. Chỉ nhìn `balance` thì không tái dựng được lịch sử. Đây cũng là cơ sở đối soát với DeliveryOrderService.

### QĐ-6: Service vẫn chạy khi Broker chết

**Quyết định.** Đăng ký/heartbeat thất bại chỉ ghi WARN; các API vẫn phục vụ bình thường; heartbeat kế
tiếp sẽ tự đăng ký lại.

**Lý do.** Broker là điểm chết đơn lẻ (single point of failure) của kiến trúc brokered. Nếu Broker sập mà
kéo theo cả 4 service cùng sập thì thiết kế quá mong manh. Ngoài ra thứ tự khởi động các service khi
demo cũng không còn quan trọng.

---

## 8. Truy vết use case

| Use case | Thao tác trên CustomerAccountService | Sequence diagram |
|---|---|---|
| Đăng ký khách hàng | `createCustomer` → `createAccount` | §3.1 |
| Xem / sửa thông tin tài khoản | `getCustomer`, `updateCustomer`, `getAccount` | §3.1 |
| **Đặt hàng** | `placeHold(orderId, amount)` | [§4.1](#41-đặt-hàng--billing-coordinator-authorize-luồng-thành-công) |
| Đặt hàng — không đủ tiền | `placeHold` → 422 | [§4.2](#42-đặt-hàng--không-đủ-tiền-luồng-thay-thế) |
| **Giao hàng (tính tiền)** | `captureHold(orderId)` | [§4.3](#43-giao-hàng--confirm-billing-trừ-tiền-thật) |
| Hủy đơn hàng | `releaseHold(orderId)` | [§4.4](#44-hủy-đơn-hàng--trả-lại-tiền) |
| Khách trả hàng | `refund(accountId, amount)` | — |
| Xem lịch sử giao dịch | `listTransactions(accountId)` | — |

### Bằng chứng kiểm thử

15 test tự động phủ các luồng trên (`./mvnw test`):

| Nhóm | Số test | Nội dung |
|---|---|---|
| `AccountServiceTest` | 9 | hold không đổi balance; capture trừ tiền; release trả tiền; không đủ tiền bị từ chối; tiền đang giữ không tính là tiền tiêu được; hold/capture idempotent; release sau capture bị từ chối; sổ cái ghi đủ các bước |
| `AccountApiTest` | 5 | Đi qua HTTP thật: luồng authorize → capture; hủy đơn; 422 khi thiếu tiền; 400 khi dữ liệu sai; 404 khi không tìm thấy |
| Context | 1 | Ứng dụng khởi động được |
