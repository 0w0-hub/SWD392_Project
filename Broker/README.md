# Broker — Online Shopping System (SWD392)

Broker đóng vai trò **service registry** trong kiến trúc brokered: các service tự đăng ký khi khởi động
(Service Registration pattern), và client tra cứu địa chỉ service qua Broker thay vì hardcode URL.

**Broker không chuyển tiếp lời gọi nghiệp vụ.** Nó chỉ trả về địa chỉ, sau đó client gọi thẳng service
(white pages lookup). Nhờ vậy Broker không trở thành nút cổ chai của mọi request — nó chỉ nằm trên đường
đi của việc *tìm* service, không nằm trên đường đi của việc *dùng* service.

```
CustomerAccountService ──đăng ký──> [Broker :8080]
Billing Coordinator ────tra cứu───> [Broker :8080] ──trả về──> "http://localhost:8081"
Billing Coordinator ────────────────gọi thẳng────────────────> CustomerAccountService :8081
```

---

## Chạy

Cần Java 17. Không cần Maven, không cần database (registry nằm trong bộ nhớ).

```bash
cd Broker
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
```

- Broker chạy ở **http://localhost:8080**
- **Dashboard**: mở http://localhost:8080 — hiện các service đang sống, tự làm mới mỗi 3 giây.
- Chạy test: `./mvnw test` (14 test)

**Thứ tự khởi động không quan trọng.** Nếu chạy service trước Broker, service sẽ ghi WARN rồi tự đăng ký
lại ở chu kỳ heartbeat kế tiếp (≤30 giây). Không cần khởi động lại service.

---

## API — hợp đồng chung của cả nhóm

| Method | Endpoint | Mô tả | Trả về |
|---|---|---|---|
| POST | `/registry/services` | Service tự đăng ký | 201 + ServiceInstance |
| PUT | `/registry/services/{serviceId}/heartbeat` | Báo "tôi còn sống" | 200, hoặc **404** nếu Broker không biết serviceId |
| DELETE | `/registry/services/{serviceId}` | Hủy đăng ký khi tắt | 204 |
| GET | `/registry/services/{serviceName}` | **Tra cứu theo tên** (white pages) | `[ServiceInstance]` |
| GET | `/registry/services?operation=placeHold` | Tra cứu theo nghiệp vụ (yellow pages) | `[ServiceInstance]` |
| GET | `/registry/services` | Liệt kê tất cả (dashboard) | `[ServiceInstance]` |

```jsonc
// POST /registry/services — body
{
  "serviceId":   "uuid",                    // bắt buộc
  "serviceName": "CustomerAccountService",  // bắt buộc — client tra cứu bằng tên này
  "version":     "1.0",
  "host":        "localhost",               // bắt buộc
  "port":        8081,                      // bắt buộc
  "baseUrl":     "http://localhost:8081",   // bắt buộc
  "healthUrl":   "http://localhost:8081/actuator/health",
  "operations":  ["placeHold", "captureHold", "..."]
}
```

Thiếu trường bắt buộc → **400 `INVALID_REGISTRATION`**, kèm rõ trường nào sai.

### Ví dụ: Billing Coordinator gọi CustomerAccountService

```bash
# 1. Hỏi Broker: CustomerAccountService đang ở đâu?
curl http://localhost:8080/registry/services/CustomerAccountService
# -> [{"serviceName":"CustomerAccountService","baseUrl":"http://localhost:8081","status":"UP", ...}]

# 2. Gọi thẳng service theo baseUrl vừa nhận được
curl -X POST http://localhost:8081/api/v1/accounts/1/holds \
  -H "Content-Type: application/json" -d '{"orderId":"ORD-001","amount":300}'
```

---

## Hai quyết định thiết kế

### Registry nằm trong bộ nhớ, không có database

Registry là trạng thái **phái sinh** — nguồn sự thật là chính các service đang chạy. Nếu Broker restart,
các service sẽ tự đăng ký lại ở chu kỳ heartbeat kế tiếp. Lưu xuống đĩa không mang lại gì, mà còn có nguy
cơ giữ lại bản ghi của những service đã chết từ lần chạy trước.

Cơ chế tự phục hồi: khi Broker restart, nó không còn biết `serviceId` cũ → heartbeat trả về **404** →
service thấy 404 sẽ tự đăng ký lại.

### Loại bỏ service quá hạn heartbeat

Service có thể chết đột ngột (kill process, mất điện) mà không kịp gọi `DELETE`. Nếu không quét dọn,
Broker sẽ trả về địa chỉ của một service đã chết và client gọi vào khoảng không.

Cứ mỗi 30 giây Broker quét và loại các service không gửi heartbeat quá **90 giây** (`registry.heartbeat-ttl-seconds`).
Ngưỡng 90s lớn hơn chu kỳ heartbeat của service (30s) đủ xa, để một lần lỡ mất gói tin không làm service
bị loại oan.

---

## Cổng của cả nhóm

| Service | Cổng |
|---|---|
| **Broker** | **8080** |
| CustomerAccountService | 8081 |
| CatalogService | 8082 |
| InventoryService | 8083 |
| DeliveryOrderService | 8084 |

## Cấu trúc code

```
registry/   ServiceRegistry (ConcurrentHashMap + bộ quét dọn), ServiceInstance,
            ServiceRegistration (hợp đồng), RegistryProperties
web/        RegistryController (4 endpoint), ApiExceptionHandler
resources/static/index.html   dashboard
```