# Kịch bản thuyết trình — EmailService (Gomaa Chương 22)

> Nguồn: Hassan Gomaa, *Software Modeling and Design*, **Chương 22 — Online Shopping System**.
> **Email Service** là external service đơn giản nhất của hệ. Cài đặt: **Node/Express**, tự đăng ký Broker.

---

## 0. Bố cục nói nhanh

1. Email Service là **external service** ở Layer 1 (Fig 22.17), *"which enables the Online Shopping System to send email messages to customers"* (sách tr. 433).
2. Interface `IEmailService` chỉ có **1 thao tác**: `sendEmail(in emailId, in emailText)` (Fig 22.24).
3. Nó là **fire-and-forget / best-effort**: gửi email lỗi **không** được làm hỏng luồng mua hàng.

---

## 1. Vị trí & interface (§22.7.5, Fig 22.24)

Sách (tr. 448): *"The Email Service has one provided interface with one operation to send an email message (message **M9a** in Make Order Request and message **S8c** in Confirm Shipment and Bill Customer)."*

| Operation (Fig 22.24) | Suy ra từ message | Endpoint thật |
|---|---|---|
| `sendEmail(emailId, emailText)` | **M9a** (xác nhận đặt hàng), **S8c** (xác nhận giao hàng) | `POST /emails` |

Bổ sung `GET /emails` để xem hộp thư đã gửi — tiện cho demo/thuyết trình.

---

## 2. Được gọi ở đâu

- **M9a** — Customer Coordinator gửi email xác nhận đơn sau khi đặt hàng thành công (Fig 22.13).
- **S8c** — Billing Coordinator gửi email xác nhận giao hàng trong lúc chốt 2PC (Fig 22.15).

Trong code Coordinator, cả hai lời gọi đều bọc `.catch(() => {})` → **best-effort**: đúng tinh thần email là thông báo phụ, không phải bước giao dịch bắt buộc.

---

## 3. Cài đặt (demo stand-in)

Đây là bản mô phỏng: thay vì gửi SMTP thật, service **lưu email vào bộ nhớ** và log ra console (`[email] -> <to>: <subject>`). Đủ để minh hoạ message M9a/S8c mà không cần cấu hình mail server.

Tự đăng ký Broker (operations `["sendEmail"]`), heartbeat 30s, best-effort — Broker down vẫn chạy.

---

## 4. DEMO

```bash
cd EmailService && npm install && npm start   # http://localhost:3005
curl -X POST http://localhost:3005/emails -H "Content-Type: application/json" \
  -d '{"to":"alice","subject":"Order confirmed","text":"Your order was placed"}'
curl http://localhost:3005/emails            # xem đã gửi gì
```

Khi chạy cả hệ: đặt hàng qua Coordinator rồi mở `GET /emails` → thấy email M9a; confirm shipment → thấy email S8c.

---

## 5. Câu hỏi có thể bị hỏi

| Câu hỏi | Trả lời |
|---|---|
| Vì sao email best-effort? | Gửi email là thông báo phụ; lỗi mail không được rollback cả đơn hàng. Coordinator bọc `.catch()`. |
| External service nghĩa là gì? | Do bên thứ ba cung cấp (nhà cung cấp email), tích hợp qua provided interface + Broker (§22.7.6). |
| Vì sao không dùng SMTP thật? | Bản demo; chỉ cần chứng minh message M9a/S8c được kích hoạt đúng chỗ. Có thể thay bằng transport thật sau. |

---

## 6. Câu kết

> "EmailService là external service tối giản đúng Fig 22.24 — một thao tác `sendEmail`, được gọi ở M9a và S8c, best-effort, discover qua Broker."

---

## Phụ lục
- Toàn bộ logic + đăng ký Broker → `src/server.js`
