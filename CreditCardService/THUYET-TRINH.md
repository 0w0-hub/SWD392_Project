# Kịch bản thuyết trình — CreditCardService (Gomaa Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design*, **Chương 22 — Online Shopping System** (tr. 424–452).
> **Credit Card Service** là một trong **hai external service** của hệ (cùng Email Service). Cài đặt: **Node/Express**, tự đăng ký Broker.

---

## 0. Bố cục 3 phút đầu

1. Credit Card Service là **external service** ở Layer 1 (Fig 22.17) — dùng để **tính tiền thẻ của khách**.
2. Sách nói có **nhiều instance**, mỗi hãng thẻ một cái (Visa, Mastercard…), nhưng **cùng một interface** `ICreditCardService` (§22.7.6).
3. Nó là **participant trong two-phase commit**: `authorizeCharge` = *prepare*, `commitCharge` = *commit*, `abortCharge` = *rollback*.
4. Interface đúng **3 thao tác** theo Fig 22.24; mỗi thao tác **idempotent theo orderId**.

> Câu chốt: *"Credit Card Service không tự quyết giao dịch — nó chỉ authorize (giữ quyền trừ tiền), rồi chờ Billing Coordinator ra lệnh commit hay abort."*

---

## 1. Vị trí trong hệ (§22.4, §22.7.2)

Sách (tr. 433): *"There is also a service class, **Credit Card Service**, which deals with credit card authorization and charging."* Và (tr. 441): các external service gồm **Credit Card Service** *"(one for each credit card company, such as Mastercard and Visa), which is used for charging customer purchases"* và Email Service.

- **Layer 1 — Service Layer**, nhóm *external services* (Fig 22.17).
- Được **Customer Coordinator** gọi khi đặt hàng (authorize) và **Billing Coordinator** gọi khi giao hàng (commit).

---

## 2. Interface — `ICreditCardService` (Fig 22.24) — TRỌNG TÂM

Fig 22.24 cho đúng **3 operation**:

| Operation (Fig 22.24) | Suy ra từ message | Vai trò 2PC | Endpoint thật |
|---|---|---|---|
| `authorizeCharge(creditcardId, amount)` | **M5** (Make Order, Fig 22.13) | **PREPARE TO COMMIT** | `POST /authorizations` |
| `commitCharge(creditcardId, amount)` | **S8a** (Confirm Shipment, Fig 22.15) | **COMMIT** | `POST /authorizations/:orderId/commit` |
| `abortCharge(creditcardId, amount)` | (hủy đơn / prepare fail) | **ROLLBACK** | `POST /authorizations/:orderId/abort` |

> Sách (tr. 448): *"The Credit Card Service supports one provided interface consisting of two operations — one for **authorizing** a credit card purchase (message M5…) and the other for **charging** the credit card (message S8a…)."* Em bổ sung `abortCharge` để hoàn tất vai trò rollback trong 2PC (đối xứng với `abortInventory`).

**Vòng đời một authorization** (`src/server.js`), keyed theo `orderId`:
```
AUTHORIZED ──commit──▶ CHARGED
    │
    └──abort──▶ ABORTED
```
Idempotent: gọi lại `authorize` cùng `orderId` trả lại bản ghi cũ; `commit`/`abort` gọi lần 2 không đổi kết quả. `commit` sau khi `ABORTED` → 409; `abort` sau khi `CHARGED` → 409 (phải dùng refund).

---

## 3. Vai trò trong 2 use case (§22.5.2 & §22.5.4)

**Make Order Request (Fig 22.13):**
```
M5: Customer Coordinator → Credit Card Service : authorizeCharge   (= Prepare to Commit)
M6: Credit Card Service  → Customer Coordinator : approved          (= Ready to Commit)
```
> Sách: *"M5: Customer Coordinator sends the customer's credit card information and charge authorization request to Credit Card Service (this is equivalent to a **Prepare to Commit** message). M6: … credit card approval (… **Ready to Commit**)."*
> Luồng thay thế A1: thẻ bị từ chối → trả **402** → Customer Coordinator hủy đơn.

**Confirm Shipment and Bill Customer (Fig 22.15):**
```
S8a: Billing Coordinator → Credit Card Service : commitCharge (Commit Charge)
```
Nằm trong 2PC cùng Delivery Order (§22.7.3): *"updates to the credit card, delivery order, and inventory are coordinated using the two-phase commit protocol."*

---

## 4. Mô phỏng "vote abort" — demo được luồng thất bại

Để demo nhánh thẻ bị từ chối (§22.5.2): service **DECLINE** khi `amount > CREDIT_LIMIT` (mặc định 1,000,000) hoặc `cardId` chứa chuỗi `"DECLINE"` → trả **402 CardDeclined**. Đây chính là "vote abort" của participant.

---

## 5. Đăng ký Broker (§22.7.3, Service Registration)

Khi khởi động, service POST đăng ký lên Broker với `operations: ["authorizeCharge","commitCharge","abortCharge"]`, rồi heartbeat mỗi 30s. Nhờ vậy Coordinator **discover** được nó theo tên `CreditCardService`. Tắt bằng `BROKER_ENABLED=false`; Broker down vẫn chạy bình thường (best-effort).

---

## 6. DEMO trực tiếp

```bash
cd CreditCardService && npm install && npm start   # http://localhost:3006
```
```bash
# authorize (M5) -> commit (S8a)
curl -X POST http://localhost:3006/authorizations -H "Content-Type: application/json" \
  -d '{"cardId":"ACC001","orderId":"1001","amount":39.99}'
curl -X POST http://localhost:3006/authorizations/1001/commit
# rollback
curl -X POST http://localhost:3006/authorizations/2002/abort
# thẻ bị từ chối (over limit) -> 402
curl -i -X POST http://localhost:3006/authorizations -H "Content-Type: application/json" \
  -d '{"cardId":"ACC001","orderId":"9999","amount":5000000}'
```

---

## 7. Câu hỏi có thể bị hỏi

| Câu hỏi | Trả lời |
|---|---|
| Vì sao Credit Card là external service? | Sách (tr. 441): nó do bên thứ ba (hãng thẻ) cung cấp, có nhiều instance (Visa/Mastercard) cùng interface. |
| `authorize` khác `commit` chỗ nào? | authorize = **prepare** (M5, giữ quyền trừ tiền); commit = **charge thật** (S8a). Tách để phục vụ 2PC. |
| Vì sao idempotent theo orderId? | Để retry an toàn khi 2PC bị gián đoạn giữa chừng — không trừ tiền 2 lần. |
| Khác gì "hold" của CustomerAccount? | Cùng ngữ nghĩa (authorize/capture/release) nhưng đây là **service thẻ chuyên trách** theo đúng Fig 22.24; CustomerAccount là ví/tài khoản khách. |

---

## 8. Câu kết

> "CreditCardService của em là **external service** đúng interface `ICreditCardService` (Fig 22.24), đóng vai **prepare/commit/abort** trong two-phase commit, idempotent theo đơn hàng, và discover được qua Broker — sẵn sàng cho Customer & Billing Coordinator gọi vào."

---

## Phụ lục — Bản đồ mã nguồn
- Toàn bộ logic + đăng ký Broker → `src/server.js` (authorize, commit, abort, registerWithBroker)
