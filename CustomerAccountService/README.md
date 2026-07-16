# CustomerAccountService — Online Shopping System (SWD392)

Người làm: **Nguyễn Thế Minh**

Service này hiện thực lớp `«service» CustomerAccountService` trong Figure 22.11, sở hữu hai entity
`Customer` và `CustomerAccount` (Figure 22.10).

Đây là **service thuần túy**: nó không điều phối ai cả, chỉ trả lời yêu cầu đến từ

- **Customer Coordinator** — tạo / xem / sửa khách hàng và tài khoản;
- **Billing Coordinator** — giữ tiền, trừ tiền, trả lại tiền cho một đơn hàng.

---

## 1. Mô hình nghiệp vụ: vì sao tách `balance` và `heldAmount`

`CustomerAccount` giữ hai con số:

| Trường | Ý nghĩa |
|---|---|
| `balance` | Tổng tiền đang có trong tài khoản |
| `heldAmount` | Phần đang bị giữ cho các đơn hàng đã authorize nhưng chưa giao |
| `availableBalance` | = `balance − heldAmount`, phần khách thực sự còn tiêu được |

Nhờ vậy hai đơn hàng đặt cùng lúc **không thể tiêu chung một khoản tiền**: đơn thứ nhất giữ tiền trước,
đơn thứ hai chỉ nhìn thấy phần còn lại.

Vòng đời thanh toán của một đơn hàng, ánh xạ đúng theo Billing Coordinator trong sách:

```
placeHold(orderId)     authorize          -> tiền bị khóa, balance chưa đổi
captureHold(orderId)   hàng đã giao       -> trừ tiền thật khỏi balance
releaseHold(orderId)   đơn hàng bị hủy    -> trả lại tiền cho khách
```

Hai điểm quan trọng khi chấm điểm:

1. **Idempotent theo `orderId`.** Billing Coordinator gọi lại API (retry, mất gói tin) thì tiền vẫn chỉ bị
   giữ/trừ/trả **đúng một lần**. Ràng buộc unique trên `order_id` bảo đảm điều này.
2. **Khóa dòng khi đổi số dư.** Mọi thao tác đổi tiền đều đi qua `findByIdForUpdate` (`PESSIMISTIC_WRITE`),
   nên hai request đồng thời trên cùng tài khoản bị tuần tự hóa thay vì cùng đọc một số dư cũ.

Mọi thay đổi số dư đều để lại một dòng trong sổ cái `AccountTransaction` để đối soát với DeliveryOrderService.

---

## 2. Chạy thử

Cần Java 17. Không cần cài Maven (đã có `mvnw`), không cần cài database (mặc định dùng H2 dạng file).

```bash
cd CustomerAccountService
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
```

- Service chạy ở **http://localhost:8081**
- Swagger UI: http://localhost:8081/swagger-ui.html
- H2 console: http://localhost:8081/h2-console
- Profile `demo` (bật sẵn) nạp sẵn 2 khách hàng + tài khoản để bấm thử ngay.

Chạy test: `./mvnw test` (15 test: 9 test nghiệp vụ + 5 test đi qua HTTP thật + 1 context load).

Muốn dùng MySQL thì sửa user/password trong `application-mysql.properties` rồi chạy:
`./mvnw spring-boot:run -Dspring-boot.run.profiles=mysql,demo`

---

## 3. API

Base path: `/api/v1`

### Customer

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/customers` | Tạo khách hàng |
| GET | `/customers` hoặc `/customers?email=` | Danh sách / tìm theo email |
| GET | `/customers/{id}` | Xem chi tiết |
| PUT | `/customers/{id}` | Cập nhật |
| DELETE | `/customers/{id}` | Ngừng kích hoạt (soft delete) |

### CustomerAccount

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/accounts` | Tạo tài khoản cho khách hàng |
| GET | `/accounts/{id}` | Xem số dư |
| GET | `/accounts/by-customer/{customerId}` | Tài khoản theo khách hàng |
| GET | `/accounts/{id}/transactions` | Sổ cái giao dịch |
| POST | `/accounts/{id}/deposit` · `/withdraw` · `/refund` | Nạp / rút / hoàn tiền |

### Dành cho Billing Coordinator

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/accounts/{id}/holds` | **Authorize**: giữ tiền cho đơn hàng |
| POST | `/accounts/holds/{orderId}/capture` | **Confirm billing**: hàng đã giao, trừ tiền |
| POST | `/accounts/holds/{orderId}/release` | Đơn hàng bị hủy, trả lại tiền |
| GET | `/accounts/holds/{orderId}` | Tra cứu trạng thái khoản giữ |

Ví dụ Billing Coordinator authorize 300 cho đơn `ORD-001`:

```bash
curl -X POST http://localhost:8081/api/v1/accounts/1/holds \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORD-001","amount":300,"description":"Don hang 2 quyen sach"}'
```

### Mã lỗi

Billing Coordinator xử lý bằng **mã HTTP**, không phải bằng cách đọc chuỗi lỗi:

| Mã | `error` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Dữ liệu đầu vào sai |
| 404 | `NOT_FOUND` | Không có khách hàng / tài khoản / đơn hàng |
| 409 | `BUSINESS_RULE_VIOLATED` | Vd: đơn đã hủy rồi mà đòi trừ tiền |
| 409 | `DUPLICATE` | Email đã được đăng ký |
| **422** | **`INSUFFICIENT_FUNDS`** | **Không đủ tiền → Billing Coordinator từ chối đơn hàng** |

---

## 4. Tích hợp Broker

Service tự đăng ký với Broker (Service Registration pattern) khi khởi động, gửi heartbeat định kỳ,
và hủy đăng ký khi tắt. **Broker chưa chạy cũng không sao**: service chỉ ghi cảnh báo và thử lại ở
chu kỳ heartbeat kế tiếp, các API vẫn phục vụ bình thường.

Hợp đồng REST của Broker — **cả nhóm cần thống nhất đúng 4 endpoint này**:

| Method | Endpoint | Body / Kết quả |
|---|---|---|
| POST | `/registry/services` | `ServiceRegistration` |
| PUT | `/registry/services/{serviceId}/heartbeat` | — |
| DELETE | `/registry/services/{serviceId}` | — |
| GET | `/registry/services/{serviceName}` | `[ServiceInstance]` |

```jsonc
// ServiceRegistration — thứ service gửi lên Broker khi đăng ký
{
  "serviceId":   "uuid",
  "serviceName": "CustomerAccountService",
  "version":     "1.0",
  "host":        "localhost",
  "port":        8081,
  "baseUrl":     "http://localhost:8081",
  "healthUrl":   "http://localhost:8081/actuator/health",
  "operations":  ["createCustomer", "placeHold", "captureHold", "..."]
}

// ServiceInstance — thứ Broker trả về khi tra cứu
{ "serviceId": "uuid", "serviceName": "...", "baseUrl": "...", "status": "UP" }
```

Muốn gọi service khác thì dùng `BrokerClient.resolveBaseUrl("CatalogService")` để lấy địa chỉ trước.

Cấu hình trong `application.properties`: `broker.enabled`, `broker.base-url`, `broker.heartbeat-interval`.
Đặt `broker.enabled=false` khi muốn demo riêng service này.

### Cổng đề xuất cho cả nhóm

| Service | Cổng |
|---|---|
| Broker | 8080 |
| **CustomerAccountService** | **8081** |
| CatalogService | 8082 |
| InventoryService | 8083 |
| DeliveryOrderService | 8084 |

---

## 5. Cấu trúc code

```
domain/       Customer, CustomerAccount, AccountHold, AccountTransaction
              (quy tắc nghiệp vụ về tiền nằm trong CustomerAccount, không nằm ở service)
repository/   4 JPA repository; các truy vấn đọc dùng "join fetch" vì open-in-view đã tắt
service/      CustomerService, AccountService — nơi Billing Coordinator gọi tới
web/          REST controller + GlobalExceptionHandler + DTO
broker/       BrokerClient, BrokerRegistrar — đăng ký / heartbeat / tra cứu
config/       DemoDataSeeder (profile demo)
```
