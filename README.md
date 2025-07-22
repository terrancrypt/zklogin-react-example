# Dự Án Sui zkLogin với React + TypeScript

## 📋 Giới Thiệu

Đây là một dự án demo tích hợp **Sui zkLogin** - một công nghệ blockchain tiên tiến cho phép người dùng đăng nhập bằng Google OAuth và thực hiện giao dịch trên blockchain Sui mà không cần quản lý private key truyền thống.

### 🎯 Mục Tiêu Học Tập
- Hiểu cách hoạt động của zkLogin trong blockchain Sui
- Tích hợp Google OAuth với blockchain
- Xây dựng ứng dụng React với TypeScript
- Thực hiện giao dịch blockchain từ web app
- Quản lý state và storage trong ứng dụng phức tạp

## 🚀 Tính Năng

- ✅ **Google OAuth Login** - Đăng nhập bằng tài khoản Google
- ✅ **zkLogin Integration** - Tích hợp Sui zkLogin protocol
- ✅ **Transaction Execution** - Thực hiện giao dịch chuyển SUI
- ✅ **State Persistence** - Lưu trạng thái khi reload trang
- ✅ **Error Handling** - Xử lý lỗi toàn diện
- ✅ **Debug Mode** - Hiển thị thông tin debug chi tiết
- ✅ **Responsive UI** - Giao diện đẹp, responsive

## 🛠 Công Nghệ Sử Dụng

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: TailwindCSS 4.x
- **Blockchain**: Sui SDK (@mysten/sui)
- **Authentication**: Google OAuth 2.0, JWT
- **Build Tool**: Vite với SWC

## 📦 Cài Đặt

### Yêu Cầu Hệ Thống
- Node.js >= 18
- npm hoặc pnpm
- Git

### Bước 1: Clone Project
```bash
git clone <repository-url>
cd zklogin-react-example
```

### Bước 2: Cài Đặt Dependencies
```bash
# Với npm
npm install

# Hoặc với pnpm (khuyến nghị)
pnpm install
```

### Bước 3: Cấu Hình Environment
```bash
# Tạo file .env
cp .env.example .env

# Chỉnh sửa .env với thông tin của bạn
```

**Nội dung file .env:**
```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_REDIRECT_URI=http://localhost:5173
VITE_FULLNODE_URL=https://fullnode.devnet.sui.io
VITE_PROVER_URL=https://prover-dev.mystenlabs.com/v1
```

### Bước 4: Chạy Development Server
```bash
npm run dev
# hoặc
pnpm dev
```

Mở trình duyệt và truy cập: `http://localhost:5173`

## 🔧 Thiết Lập Google OAuth

### Tạo Google OAuth Client ID

1. **Truy cập Google Cloud Console**
   - Vào [Google Cloud Console](https://console.cloud.google.com/)
   - Tạo project mới hoặc chọn project hiện có

2. **Bật APIs**
   - Vào "APIs & Services" → "Library"
   - Tìm và bật "Google+ API"

3. **Tạo OAuth Credentials**
   - Vào "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Chọn "Web application"
   - Thêm `http://localhost:5173` vào "Authorized redirect URIs"
   - Copy Client ID và paste vào file `.env`

## 📚 Hướng Dẫn Sử Dụng

### Bước 1: Đăng Nhập
1. Click nút "Login with Google"
2. Chọn tài khoản Google của bạn
3. Cho phép ứng dụng truy cập thông tin cơ bản

### Bước 2: Chờ Setup zkLogin
- Ứng dụng sẽ tự động setup zkLogin
- Quá trình này bao gồm:
  - Tạo ephemeral keypair
  - Generate randomness và nonce
  - Gọi Prover API để tạo zkProof
  - Tính toán zkLogin address

### Bước 3: Thực Hiện Giao Dịch
1. Sau khi setup xong, click "Send 1 SUI"
2. Giao dịch sẽ được thực hiện trên Sui Devnet
3. Xem kết quả trên Sui Explorer

### Bước 4: Debug và Khám Phá
- Click "Debug Information" để xem chi tiết
- Kiểm tra Console để theo dõi logs
- Thử reset và đăng nhập lại

## 🏗 Cấu Trúc Dự Án

```
src/
├── App.tsx              # Component chính
├── main.tsx             # Entry point
├── index.css            # Styles chính
└── vite-env.d.ts        # Type definitions
```

### Các Constants Quan Trọng (trong App.tsx)

```typescript
// Google OAuth Configuration
const CLIENT_ID = "your-google-client-id";
const REDIRECT_URI = "http://localhost:5173";

// Sui Network Configuration  
const FULLNODE_URL = "https://fullnode.devnet.sui.io";
const SUI_PROVER_DEV_ENDPOINT = "https://prover-dev.mystenlabs.com/v1";

// Transaction Configuration
const TRANSFER_AMOUNT = 1n; // Số SUI sẽ chuyển
const RECIPIENT_ADDRESS = "0x..."; // Địa chỉ nhận
```

## 🎓 Kiến Thức Cần Nắm

### 1. zkLogin là gì?
zkLogin là một công nghệ cho phép người dùng sử dụng OAuth providers (Google, Facebook, etc.) để tương tác với blockchain mà không cần quản lý private keys.

### 2. Luồng hoạt động zkLogin:
```
1. User đăng nhập OAuth → JWT token
2. Tạo ephemeral keypair (tạm thời)
3. Generate randomness và nonce  
4. Gọi Prover API → zkProof
5. Tính zkLogin address từ JWT + salt
6. Ký transaction với ephemeral key
7. Kết hợp với zkProof → zkLogin signature
8. Submit transaction lên blockchain
```

### 3. Các khái niệm quan trọng:
- **Ephemeral Keypair**: Cặp key tạm thời, chỉ tồn tại trong session
- **Randomness**: Số ngẫu nhiên để bảo mật
- **Salt**: Giá trị để tạo địa chỉ duy nhất
- **Nonce**: Số chỉ dùng một lần, ngăn replay attacks
- **zkProof**: Bằng chứng zero-knowledge từ JWT

## 🔍 Debugging

### Công cụ Debug
1. **Browser Console**: Xem logs và errors
2. **Debug Information Panel**: Xem state chi tiết
3. **Network Tab**: Theo dõi API calls
4. **Sui Explorer**: Xem giao dịch trên blockchain

### Lỗi Thường Gặp

| Lỗi                | Nguyên Nhân                   | Giải Pháp          |
| ------------------ | ----------------------------- | ------------------ |
| JWT Invalid        | Google OAuth setup sai        | Kiểm tra Client ID |
| Network Error      | Kết nối internet              | Kiểm tra mạng      |
| Transaction Failed | Không đủ gas hoặc sai địa chỉ | Kiểm tra balance   |
| Prover API Error   | Server overload               | Thử lại sau        |

## 🎨 Customization

### Thay đổi giao diện
```typescript
// Trong App.tsx, tìm các className để thay đổi styling
className="px-8 py-4 rounded-lg bg-blue-600 text-white..."
```

### Thay đổi số tiền chuyển
```typescript
const TRANSFER_AMOUNT = 5n; // Chuyển 5 SUI thay vì 1
```

### Thay đổi địa chỉ nhận
```typescript
const RECIPIENT_ADDRESS = "0x1234..."; // Địa chỉ ví của bạn
```

## 🚀 Build và Deploy

### Build Production
```bash
npm run build
# hoặc
pnpm build
```

### Preview Production Build
```bash
npm run preview
# hoặc  
pnpm preview
```

### Deploy lên Vercel
```bash
# Cài Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 📖 Tài Liệu Tham Khảo

- [Sui zkLogin Documentation](https://docs.sui.io/concepts/cryptography/zklogin)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Đóng Góp

### Báo Lỗi
1. Tạo issue mới trên GitHub
2. Mô tả chi tiết lỗi và cách reproduce
3. Attach screenshots nếu có

### Đề Xuất Tính Năng
1. Fork repository
2. Tạo branch mới cho feature
3. Implement và test
4. Tạo Pull Request

## 📝 Bài Tập Thực Hành

### Bài Tập 1: Cơ Bản
- [ ] Setup và chạy được dự án
- [ ] Đăng nhập thành công bằng Google
- [ ] Thực hiện giao dịch chuyển SUI
- [ ] Xem transaction trên Sui Explorer

### Bài Tập 2: Customization
- [ ] Thay đổi số tiền chuyển thành 0.1 SUI
- [ ] Thay đổi màu button thành màu xanh lá
- [ ] Thêm thông báo success sau khi giao dịch thành công

### Bài Tập 3: Nâng Cao
- [ ] Thêm tính năng xem balance của zkLogin address
- [ ] Implement multiple recipients (chuyển cho nhiều người)
- [ ] Thêm history giao dịch
- [ ] Tích hợp với Sui NFTs

### Bài Tập 4: Refactoring
- [ ] Tách constants ra file riêng
- [ ] Tạo custom hooks cho zkLogin logic
- [ ] Chia UI thành các components nhỏ
- [ ] Thêm error boundaries

## ❓ FAQ

**Q: Tại sao cần zkLogin?**
A: zkLogin giúp người dùng sử dụng blockchain mà không cần hiểu về private keys, giảm barrier to entry.

**Q: zkLogin có an toàn không?**
A: Có, zkLogin sử dụng zero-knowledge proofs để đảm bảo privacy và security.

**Q: Có thể dùng trên mainnet không?**
A: Hiện tại demo này chạy trên devnet. Để dùng mainnet cần thay đổi endpoints và cẩn thận hơn.

**Q: Tại sao transaction failed?**
A: Thường do không đủ gas fee hoặc địa chỉ nhận không hợp lệ. Kiểm tra balance và địa chỉ.

---

**Chúc bạn học tập vui vẻ! 🎉**

> **Lưu ý**: Dự án này chỉ dành cho mục đích học tập. Không sử dụng trên mainnet với số tiền lớn khi chưa hiểu rõ về security.
