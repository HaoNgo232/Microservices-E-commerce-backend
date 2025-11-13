# Hướng Dẫn Setup SePay với BIDV

## Vấn Đề Quan Trọng

**BIDV API không thể đồng bộ giao dịch qua tài khoản chính.**

Bạn PHẢI dùng **tài khoản ảo (VA - Virtual Account)** thay vì số tài khoản chính.

## Quy Trình Setup

### 1. Đăng Ký Tài Khoản SePay

- Truy cập: https://my.sepay.vn
- Đăng ký tài khoản
- Xác thực thông tin

### 2. Tạo Tài Khoản Ảo (VA)

- Login vào SePay Dashboard
- Vào mục **"Tài khoản ảo"** hoặc **"Virtual Account"**
- Chọn ngân hàng **BIDV**
- Nhập thông tin:
  - Số tài khoản chính BIDV của bạn (VD: 8890116911)
  - Tên chủ tài khoản (VD: "NGUYEN VAN A")
- SePay sẽ tạo số tài khoản ảo (VA) cho bạn

**Format VA:** `{SốChính}{MãVA}`

Ví dụ:

- Số chính: `8890116911`
- Mã VA: `HAOVA`
- **Số VA:** `96247HAOVA` (đây là số bạn dùng trong QR)

### 3. Cấu Hình Webhook

- Trong SePay Dashboard, vào **Webhook Settings**
- Thêm webhook URL: `https://your-domain.com/payments/webhook/sepay`
- Lưu secret key (nếu có)

### 4. Update File `.env`

```bash
# Số tài khoản ảo (VA) - KHÔNG phải số tài khoản chính
SEPAY_ACCOUNT_NUMBER=96247HAOVA

# Tên ngân hàng
SEPAY_BANK_NAME=BIDV

# Tên hiển thị trên QR code
ACCOUNT_NAME="NGUYEN VAN A"
```

### 5. Test QR Code

URL mẫu đúng:

```
https://qr.sepay.vn/img?acc=96247HAOVA&bank=BIDV&amount=2000&des=DH12345678&accountName=NGUYEN%20VAN%20A&template=compact
```

**Khi quét QR:**

- Số tài khoản: `96247HAOVA` (VA)
- Tên người nhận: `NGUYEN VAN A` (từ ACCOUNT_NAME)
- Số tiền: `2,000 VND`
- Nội dung: `DH12345678`

## Troubleshooting

### QR code hiển thị sai tên người nhận

**Nguyên nhân:** `ACCOUNT_NAME` không đúng hoặc thiếu

**Giải pháp:**

```bash
ACCOUNT_NAME="TEN_CHINH_XAC_DA_DANG_KY"
```

### Webhook không hoạt động

**Nguyên nhân:**

1. Chưa đăng ký VA tại SePay
2. Số VA sai
3. ACCOUNT_NAME không khớp với đăng ký
4. Webhook URL chưa config

**Giải pháp:**

- Kiểm tra lại VA trên SePay Dashboard
- Đảm bảo `SEPAY_ACCOUNT_NUMBER` là số VA (VD: `96247HAOVA`)
- Đảm bảo `ACCOUNT_NAME` khớp với tên đã đăng ký

### So sánh: Tài khoản chính vs Tài khoản ảo

| Loại              | Số tài khoản | Dùng cho QR? | Webhook? |
| ----------------- | ------------ | ------------ | -------- |
| Tài khoản chính   | 8890116911   | KHÔNG        | KHÔNG    |
| Tài khoản ảo (VA) | 96247HAOVA   | CÓ           | CÓ       |

## Lưu Ý Bảo Mật

- **KHÔNG commit file `.env`** vào Git
- Chỉ share số VA, không share số tài khoản chính
- Rotate webhook secret key định kỳ
- Monitor transactions trong SePay Dashboard

## Tài Liệu Tham Khảo

- SePay Dashboard: https://my.sepay.vn
- SePay Docs: https://sepay.vn/lap-trinh-cong-thanh-toan.html
- BIDV API Docs: (liên hệ SePay support)

## Support

Nếu gặp vấn đề:

1. Kiểm tra SePay Dashboard → Transactions
2. Check webhook logs
3. Liên hệ SePay support: support@sepay.vn
