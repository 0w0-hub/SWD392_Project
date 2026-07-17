# Kịch bản thuyết trình — Broker / Service Registry (theo sách Gomaa, Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design*, **Chương 22 — Service-Oriented Architecture Case Study: Online Shopping System** (tr. 424–452), bổ trợ Chương 16 (Broker patterns).
> Bài này trình bày **Broker** đúng theo cách sách mô tả hạ tầng SOA, rồi ánh xạ sang bản cài đặt của em (**Spring Boot 3, Java 17, registry in-memory, không database**).

---

## 0. Bố cục 3 phút đầu (nói gì trước)

1. Broker **không phải** một trong 6 dịch vụ nghiệp vụ. Nó là **hạ tầng SOA** — nơi service đăng ký và client tra cứu (sách §22.1, §22.7.1).
2. Sách nói ngay câu mở chương: *"object brokers are used to provide **service registration, brokering, and discovery**."* Broker của em làm đúng 3 việc đó.
3. Nó hiện thực 2 pattern của sách: **Broker Handle** (§22.7.3) + **Service Discovery** (§22.7.1, §22.7.3), với **white pages** (tra theo tên service) và **yellow pages** (tra theo operation).
4. Điểm cốt lõi: Broker **chỉ trả về địa chỉ**, client gọi thẳng service → Broker **không nằm trên đường đi của request nghiệp vụ**, nhờ đó binding giữa provider và requester là **động** (§22.7.6).

---

## 1. Bối cảnh — Broker nằm ở đâu trong hệ? (§22.1, §22.7.1, §22.7.2)

Hệ **Online Shopping System** là ứng dụng phân tán trên Web thiết kế theo **SOA**. Sách mô tả rõ vai trò của broker ngay ở đoạn tóm tắt chương:

> *"The solution uses a service-oriented architecture with multiple services; coordinator objects are used to facilitate the integration of the services. In addition, **object brokers are used to provide service registration, brokering, and discovery**."* (tr. 424)

Và §22.7.1 mô tả chính xác cơ chế mà Broker của em cài đặt:

> *"In service-oriented architectures, **services register their service name and location with a broker**. Clients can then **discover new services** by using the **Service Discovery pattern (also known as yellow pages)** to query the broker for services of a given type. The client can then choose a service and make a **white pages request** to the broker."*

**Điểm mấu chốt về vị trí kiến trúc:** hệ được thiết kế 3 lớp theo **Layers of Abstraction pattern** (§22.7.2, Fig 22.17):

```
Layer 3 — User Layer          : Customer / Supplier Interaction
Layer 2 — Coordination Layer  : Customer / Supplier / Billing Coordinator
Layer 1 — Service Layer       : Catalog, DeliveryOrder, Inventory, CustomerAccount, CreditCard, Email
```

> Câu chốt: *"Broker **không nằm trong 3 lớp nghiệp vụ** này. Fig 22.17 là kiến trúc phân lớp của phần nghiệp vụ; còn Broker là **hạ tầng cắt ngang** — thứ giúp Layer 2 (Coordinator) tìm được Layer 1 (Service) mà không cần hardcode URL. Sách xếp nó vào phần hỗ trợ Broker & Wrapper technology (§22.6) và Architectural Communication Patterns (§22.7.3), tách khỏi các service class."*

Trong dự án của nhóm: mỗi service (CatalogService, InventoryService, CustomerAccountService, DeliveryOrderService...) tự đăng ký với Broker; các Coordinator discover service qua Broker rồi gọi thẳng.

---

## 2. Vì sao SOA cần Broker — binding động (§22.7.6)

Đây là lý do tồn tại của cả service. Sách §22.7.6 (Design of Service-Oriented Software Architecture) nói:

> *"The provided interfaces of the services and the required ports of the coordinators are explicitly depicted in order to identify that **services are intended to be discovered**; thus, **the binding between the service provider and the service requester is dynamic**."*

**Câu chuyện phải kể:**

> "Coordinator là *requester*, Service là *provider*. Nếu Coordinator hardcode `http://localhost:8083` thì binding là **tĩnh** — đổi cổng, đổi máy, chạy nhiều instance là gãy. Broker biến binding thành **động**: Coordinator hỏi Broker *'InventoryService đang ở đâu?'* ngay lúc chạy, Broker trả địa chỉ hiện thời. Provider có thể khởi động sau, đổi cổng, chết rồi sống lại — requester không cần biết."

Hệ quả thực tế trong dự án nhóm: **mỗi service dùng stack khác nhau** (Broker viết bằng Java/Spring Boot, InventoryService viết bằng Node/Express, CatalogService có thể NestJS...) mà vẫn ghép nối được, vì tất cả chỉ cần tuân theo **một hợp đồng đăng ký chung** (`ServiceRegistration`) và giao tiếp qua HTTP. Đây đúng tinh thần SOA của sách: service độc lập stack, ghép nối qua broker.

---

## 3. Mô hình dữ liệu của registry — TRỌNG TÂM STATIC

Broker không quản lý entity nghiệp vụ. Nó quản lý **thông tin đăng ký service**. Sách (§22.7.3, Broker Handle) định nghĩa đúng những gì cần lưu:

> *"Each service registers service information, including **service name, service description and location** with the broker."*

**`ServiceRegistration`** (bản ghi service gửi lên khi đăng ký — `registry/ServiceRegistration.java`):

| Trường | Bắt buộc | Ý nghĩa (ánh xạ sách) |
|---|---|---|
| `serviceId` | `@NotBlank` | ID instance (khóa trong registry) — cho phép nhiều instance cùng `serviceName` |
| `serviceName` | `@NotBlank` | **"service name"** — thứ client tra cứu (white pages) |
| `version` | — | Phiên bản service |
| `host` | `@NotBlank` | **"location"** — máy chủ |
| `port` | `@NotNull` | **"location"** — cổng |
| `baseUrl` | `@NotBlank` | **"location"** — URL client dùng để gọi thẳng |
| `healthUrl` | — | Endpoint health-check |
| `operations` | — | Danh sách **nghiệp vụ** service cung cấp → nền tảng cho yellow pages |

**`ServiceInstance`** (bản ghi sống trong registry — `registry/ServiceInstance.java`): copy các trường trên, cộng thêm trạng thái vòng đời:

| Trường thêm | Vai trò |
|---|---|
| `registeredAt` | Mốc đăng ký |
| `lastHeartbeat` (**`volatile`**) | Mốc heartbeat gần nhất — dùng để phát hiện service chết |
| `getStatus()` → `"UP"` | Client chỉ gọi instance status UP |

> Sách nói registry lưu "name + description + location". Bản cài của em còn thêm `operations` (để làm yellow pages) và `lastHeartbeat` (để dọn service chết) — đây là phần bổ sung vận hành ngoài phạm vi mô tả tĩnh của sách, nhưng phục vụ đúng mục tiêu "brokering + discovery".

**Vì sao registry nằm trong bộ nhớ, không database** (`ServiceRegistry` dùng `ConcurrentHashMap`):

> *"Registry là trạng thái **phái sinh** — nguồn sự thật là chính các service đang chạy. Nếu Broker restart, các service tự đăng ký lại ở chu kỳ heartbeat kế tiếp. Lưu xuống đĩa không mang lại gì, mà còn có nguy cơ giữ lại bản ghi của service đã chết từ lần chạy trước."* (comment ở `ServiceRegistry.java:15-21`)

---

## 4. Interface của Broker — 3 nhóm thao tác (`web/RegistryController.java`) — TRỌNG TÂM

Toàn bộ hợp đồng nằm dưới `@RequestMapping("/registry/services")`. Chia đúng theo 3 chức năng sách nêu (registration, brokering, discovery):

| # | Method + Endpoint | Chức năng theo sách | Việc làm |
|---|---|---|---|
| 1 | `POST /registry/services` | **Service Registration** | Đăng ký (hoặc ghi đè nếu trùng `serviceId`) → **201** + `ServiceInstance` |
| 2 | `PUT /registry/services/{serviceId}/heartbeat` | Duy trì sự sống | **200** nếu còn biết; **404** nếu Broker quên (→ service tự đăng ký lại) |
| 3 | `DELETE /registry/services/{serviceId}` | Hủy đăng ký khi tắt êm | **204** No Content |
| 4 | `GET /registry/services/{serviceName}` | **Discovery — white pages** | Tra theo **tên service** → `[ServiceInstance]` |
| 5 | `GET /registry/services?operation=placeHold` | **Discovery — yellow pages** | Tra theo **nghiệp vụ** → `[ServiceInstance]` |
| 6 | `GET /registry/services` | Liệt kê tất cả (dashboard) | Toàn bộ registry, sắp theo tên |

### White pages vs Yellow pages — ánh xạ chính xác

Sách §22.7.1 phân biệt:
- **Yellow pages** = *"query the broker for services of a given **type**"* — tra theo **loại/nghiệp vụ**, chưa biết chọn service cụ thể nào.
- **White pages** = *"choose a service and make a **white pages request**"* — đã biết **tên cụ thể**, hỏi địa chỉ.

Ánh xạ vào code (`ServiceRegistry.java`):

```java
// WHITE PAGES — tra theo TÊN service  (dòng 72-76)
public List<ServiceInstance> findByName(String serviceName) {
    return instances.values().stream()
            .filter(i -> i.getServiceName().equalsIgnoreCase(serviceName))
            .toList();
}

// YELLOW PAGES — tra theo NGHIỆP VỤ service cung cấp  (dòng 79-83)
public List<ServiceInstance> findByOperation(String operation) {
    return instances.values().stream()
            .filter(i -> i.getOperations().stream().anyMatch(op -> op.equalsIgnoreCase(operation)))
            .toList();
}
```

> Câu chốt: *"`GET /registry/services/InventoryService` là **white pages** — em đã biết tên, chỉ xin địa chỉ. `GET /registry/services?operation=placeHold` là **yellow pages** — em không quan tâm service tên gì, chỉ cần *ai đó biết làm nghiệp vụ placeHold*. Sách §22.7.1 tách đúng 2 kiểu tra cứu này."*

**Một chi tiết thiết kế đắt giá:** tra cứu không thấy → trả **mảng rỗng `[]`, KHÔNG phải 404** (`RegistryController.java:78-84`):

> *"'Chưa có service nào tên đó đang chạy' là một câu trả lời hợp lệ, không phải lỗi."* Có test khẳng định điều này (`traCuuServiceChuaChay_thiTraVeMangRong_khongPhai404`).

---

## 5. Vòng đời một service trong Broker — register → heartbeat → deregister + TTL sweep

Đây là phần vận hành, chỗ ghi điểm về độ chắc chắn của hệ.

```
      POST /registry/services            ┌──────────────────┐
Service ─────đăng ký────────────────────>│                  │
      PUT .../{id}/heartbeat  (mỗi ~30s) │   BROKER :8080   │  ConcurrentHashMap
Service ─────"tôi còn sống"─────────────>│   ServiceRegistry │  serviceId -> ServiceInstance
      DELETE .../{id}  (khi tắt êm)      │                  │
Service ─────hủy đăng ký────────────────>│                  │
                                         └──────────────────┘
                                    @Scheduled mỗi 30s: evictExpired()
                                    (loại instance quá 90s không heartbeat)
```

### 5.1 Register (POST) — `ServiceRegistry.register()` dòng 35-45

Dùng `instances.put(serviceId, instance)`. Nếu `serviceId` đã tồn tại → **ghi đè** (service restart với cùng id, không tạo bản trùng). Test `dangKyLaiCungServiceId_thiKhongTaoBanGhiTrung` khẳng định `findAll()` chỉ còn 1 bản.

### 5.2 Heartbeat (PUT) — `ServiceRegistry.heartbeat()` dòng 53-60

```java
public boolean heartbeat(String serviceId) {
    ServiceInstance instance = instances.get(serviceId);
    if (instance == null) return false;   // Broker không còn biết id này
    instance.touch();                     // cập nhật lastHeartbeat = now
    return true;
}
```

Controller map `false → 404`. **Cơ chế tự phục hồi (self-healing):** khi Broker restart, registry rỗng, mọi heartbeat cũ trả **404**, service thấy 404 sẽ **tự đăng ký lại** ở chu kỳ kế tiếp. Không cần khởi động lại service. Test: `heartbeatCuaServiceLa_thiTraVe404_deServiceTuDangKyLai`.

### 5.3 Deregister (DELETE) — dòng 62-69

Tắt êm thì gọi DELETE để rời registry ngay lập tức, không đợi hết TTL.

### 5.4 TTL sweep — `evictExpired()` dòng 102-114 (điểm kỹ thuật đắt nhất về vận hành)

```java
@Scheduled(fixedDelayString = "${registry.sweep-interval-seconds:30}", timeUnit = TimeUnit.SECONDS)
public void evictExpired() {
    Instant now = Instant.now();
    long ttl = properties.getHeartbeatTtlSeconds();     // mặc định 90s
    instances.values().removeIf(instance -> instance.isExpired(now, ttl));
}
```

Cấu hình (`application.properties`):
```properties
registry.heartbeat-ttl-seconds=90    # quá 90s không heartbeat -> coi là chết
registry.sweep-interval-seconds=30   # cứ 30s quét một lần
```

> Câu chốt: *"Service có thể chết **đột ngột** (kill process, mất điện) mà không kịp gọi DELETE. Nếu không quét dọn, Broker sẽ trả về địa chỉ của một service đã chết và client **gọi vào khoảng không**. Ngưỡng TTL 90s cố ý lớn hơn chu kỳ heartbeat 30s **gấp 3 lần** — để một lần lỡ mất gói tin không làm service bị loại oan."*

`isExpired()` (`ServiceInstance.java:46-49`): `lastHeartbeat.plusSeconds(ttl)` không còn sau `now` thì hết hạn. Test `serviceChetKhongGuiHeartbeat_thiBiLoaiKhoiRegistry` set TTL=0 để ép hết hạn ngay và kiểm chứng bị loại.

---

## 6. Điểm kỹ thuật đắt giá — Thread-safety (đọc/ghi registry đồng thời)

Registry bị **nhiều luồng đụng cùng lúc**: nhiều service gửi heartbeat song song, Coordinator tra cứu, và bộ quét `@Scheduled` chạy nền. Hai lớp phòng vệ:

1. **`ConcurrentHashMap`** cho bảng `instances` (`ServiceRegistry.java:27`) — put/get/remove/`removeIf` an toàn đa luồng, không cần khóa toàn cục, đọc không bị chặn.

2. **`volatile Instant lastHeartbeat`** trong `ServiceInstance` (dòng 25). Comment giải thích chính xác:

> *"Đối tượng này bị nhiều luồng đọc/ghi cùng lúc (service gửi heartbeat, client tra cứu, bộ quét dọn service chết), nên `lastHeartbeat` phải là volatile."*

> Câu chốt: *"Luồng heartbeat gọi `touch()` ghi `lastHeartbeat`; luồng sweep đọc nó trong `isExpired()`. Không có `volatile`, luồng sweep có thể đọc giá trị cũ nằm trong cache CPU và loại nhầm một service vừa mới heartbeat. `volatile` bảo đảm ghi ở luồng này **lập tức hiển thị** với luồng kia."*

Các trường còn lại của `ServiceInstance` là `final` (bất biến sau khi tạo) nên vốn đã an toàn — chỉ `lastHeartbeat` thay đổi nên chỉ nó cần `volatile`.

---

## 7. Xử lý lỗi đăng ký (`web/ApiExceptionHandler.java`)

Bản đăng ký thiếu trường bắt buộc (`serviceId`/`serviceName`/`host`/`port`/`baseUrl`) → Bean Validation ném `MethodArgumentNotValidException` → handler map thành **400** với body rõ ràng:

```json
{ "error": "INVALID_REGISTRATION", "message": "...", "fieldErrors": { "serviceName": "must not be blank" } }
```

Test `banDangKyThieuTruongBatBuoc_thiTraVe400` gửi `serviceName = "  "` và kiểm chứng nhận `400` + `error = INVALID_REGISTRATION`. Đây là "hợp đồng đăng ký" mà cả 4 service trong nhóm phải tuân.

---

## 8. Ánh xạ Sách → Code (slide tổng kết)

| Khái niệm trong sách (Ch 22) | Nơi trong code |
|---|---|
| *"service registration, brokering, and discovery"* (tr. 424) | Cả module `broker` |
| **Broker Handle** — lưu name + description + location (§22.7.3) | `ServiceRegistration`, `ServiceInstance` |
| **Service Registration** — service tự đăng ký (§22.7.1) | `POST /registry/services` → `ServiceRegistry.register()` |
| **Service Discovery / yellow pages** — tra theo type (§22.7.1, §22.7.3) | `GET ?operation=` → `findByOperation()` (dòng 79-83) |
| **White pages** — chọn service theo tên (§22.7.1) | `GET /{serviceName}` → `findByName()` (dòng 72-76) |
| **Binding động** provider↔requester (§22.7.6) | Broker chỉ trả địa chỉ; client gọi thẳng service |
| **Layers of Abstraction** (§22.7.2) — Broker là hạ tầng cắt ngang | `BrokerApplication` (không nằm trong 3 lớp nghiệp vụ) |
| Vòng đời + TTL (vận hành, ngoài sách) | `heartbeat()`, `deregister()`, `evictExpired()` |

---

## 9. DEMO trực tiếp

```bash
cd Broker
./mvnw spring-boot:run     # Windows: mvnw.cmd spring-boot:run
# Broker chạy http://localhost:8080  — Dashboard: mở http://localhost:8080 (tự refresh 3s)
```

**Bước 1 — Service tự đăng ký (Service Registration):**

```bash
curl -X POST http://localhost:8080/registry/services ^
  -H "Content-Type: application/json" ^
  -d "{\"serviceId\":\"inv-1\",\"serviceName\":\"InventoryService\",\"version\":\"1.0\",\"host\":\"localhost\",\"port\":8083,\"baseUrl\":\"http://localhost:8083\",\"healthUrl\":\"http://localhost:8083/actuator/health\",\"operations\":[\"checkInventory\",\"reserveInventory\",\"commitInventory\"]}"
```
→ **201 Created** + body `ServiceInstance` (có `status: "UP"`).

**Bước 2 — Client discover (WHITE PAGES: tra theo tên):**

```bash
curl http://localhost:8080/registry/services/InventoryService
```
→ `[{"serviceName":"InventoryService","baseUrl":"http://localhost:8083","status":"UP", ...}]`
→ Coordinator lấy `baseUrl` rồi **gọi thẳng** `http://localhost:8083` (Broker không đứng giữa).

**Bước 3 — Discover (YELLOW PAGES: tra theo nghiệp vụ):**

```bash
curl "http://localhost:8080/registry/services?operation=reserveInventory"
```
→ Trả về mọi service **biết làm** `reserveInventory`, dù tên gì.

**Bước 4 — Heartbeat (giữ sống):**

```bash
curl -X PUT http://localhost:8080/registry/services/inv-1/heartbeat     # -> 200
curl -X PUT http://localhost:8080/registry/services/khong-ton-tai/heartbeat   # -> 404 (service sẽ tự đăng ký lại)
```

**Bước 5 — Deregister (tắt êm):**

```bash
curl -X DELETE http://localhost:8080/registry/services/inv-1     # -> 204
curl http://localhost:8080/registry/services/InventoryService    # -> []  (mảng rỗng, KHÔNG phải 404)
```

**Demo TTL sweep (nếu có thời gian):** đăng ký service, **ngừng heartbeat**, đợi > 90s → gọi `GET /registry/services` thấy nó biến mất (bị `evictExpired` loại).

---

## 10. Câu hỏi có thể bị hỏi (chuẩn bị sẵn)

| Câu hỏi | Trả lời (bám sách + code) |
|---|---|
| Broker có phải 1 trong 6 dịch vụ không? | **Không.** 6 service ở Layer 1 (Fig 22.17) là nghiệp vụ. Broker là **hạ tầng SOA** cho registration/brokering/discovery (§22.1, §22.7.1), cắt ngang các lớp. |
| White pages khác yellow pages chỗ nào? | White pages = tra theo **tên** đã biết (`findByName`, `GET /{serviceName}`); yellow pages = tra theo **nghiệp vụ/type** chưa biết chọn ai (`findByOperation`, `?operation=`). Sách §22.7.1 phân biệt đúng vậy. |
| Broker có làm chậm mọi request không? | Không. Broker **chỉ trả địa chỉ**; client gọi thẳng service. Broker nằm trên đường *tìm* service, không nằm trên đường *dùng* service → không thành nút cổ chai (`BrokerApplication` javadoc). |
| Vì sao registry không dùng database? | Registry là trạng thái **phái sinh**; nguồn sự thật là service đang chạy. Restart thì service tự đăng ký lại. DB chỉ có nguy cơ giữ bản ghi service đã chết (`ServiceRegistry` javadoc). |
| Service chết đột ngột thì sao? | `@Scheduled evictExpired()` mỗi 30s loại instance quá 90s không heartbeat → không trả địa chỉ chết cho client. |
| Broker restart mất hết registry thì sao? | Heartbeat cũ trả **404** → service **tự đăng ký lại** (self-healing). Không cần thao tác tay. |
| Tại sao chỉ `lastHeartbeat` là volatile? | Chỉ nó thay đổi và bị nhiều luồng đọc/ghi (heartbeat vs sweep); các trường khác `final`. `ConcurrentHashMap` lo phần bảng. |
| Sao mỗi service viết stack khác nhau vẫn chạy chung? | SOA cho binding **động** (§22.7.6): chỉ cần tuân hợp đồng `ServiceRegistration` + HTTP. Broker Java, Inventory Node, Catalog NestJS đều ghép được. |
| Tra cứu không thấy sao không trả 404? | "Chưa có service tên đó chạy" là câu trả lời hợp lệ → trả `[]` (mảng rỗng). Có test khẳng định. |

---

## 11. Câu kết mạnh

> "Đúng như sách Gomaa Chương 22, Broker của em **không phải một dịch vụ nghiệp vụ** mà là **hạ tầng của SOA** — làm đúng ba việc *service registration, brokering, and discovery* mà sách nêu ngay câu mở chương. Em hiện thực **Broker Handle** (lưu name + location) và **Service Discovery** với đủ **white pages** (theo tên) lẫn **yellow pages** (theo nghiệp vụ), cộng vòng đời register/heartbeat/deregister và bộ quét TTL để registry luôn phản ánh thực tế. Nhờ đó binding giữa Coordinator và Service là **động** (§22.7.6) — mỗi service tự do chọn công nghệ, khởi động bất kỳ thứ tự nào, mà cả hệ vẫn tự ghép nối và tự phục hồi."

---

## Phụ lục — Bản đồ mã nguồn (khi bị hỏi vào code)

- **Điểm vào + triết lý Broker** → `src/main/java/com/swd392/onlineshopping/broker/BrokerApplication.java` (javadoc dòng 8-18; `@EnableScheduling` dòng 21)
- **Hợp đồng đăng ký** → `registry/ServiceRegistration.java` (record + ràng buộc `@NotBlank`/`@NotNull`)
- **Bản ghi sống + `volatile lastHeartbeat`** → `registry/ServiceInstance.java` (dòng 25; `isExpired()` 46-49; `touch()` 40-42)
- **Lõi registry** → `registry/ServiceRegistry.java`
  - `register()` 35-45 · `heartbeat()` 53-60 · `deregister()` 62-69
  - **white pages** `findByName()` 72-76 · **yellow pages** `findByOperation()` 79-83
  - **TTL sweep** `evictExpired()` 102-114 (`@Scheduled` 102)
- **Cấu hình TTL** → `registry/RegistryProperties.java` + `resources/application.properties` (dòng 7-8: `heartbeat-ttl-seconds=90`, `sweep-interval-seconds=30`; port 8080 dòng 2)
- **6 endpoint REST** → `web/RegistryController.java` (POST 34 · heartbeat 46 · DELETE 54 · list/yellow 68 · white 81)
- **Map lỗi validation → 400** → `web/ApiExceptionHandler.java`
- **Dashboard** → `resources/static/index.html`
- **Test hành vi** → `test/.../registry/ServiceRegistryTest.java` (10 test) · `test/.../web/RegistryApiTest.java` (vòng đời + 404 + mảng rỗng + 400)
