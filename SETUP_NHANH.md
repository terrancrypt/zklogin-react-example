# Setup Nhanh - Sui zkLogin React Example

## Yêu Cầu Hệ Thống
- Node.js >= 18
- npm hoặc pnpm
- Git

## Các Bước Setup Nhanh

### 1. Clone và Cài Đặt
```bash
# Tạo dự án mới
npm create vite@latest zklogin-react-example -- --template react-ts
cd zklogin-react-example

# Cài đặt dependencies
npm install @mysten/sui@^1.36.1 @tailwindcss/vite@^4.1.11 axios@^1.10.0 jwt-decode@^4.0.0 query-string@^9.2.2 tailwindcss@^4.1.11
```

### 2. Tạo File Cấu Hình

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**src/index.css:**
```css
@import "tailwindcss";
```

### 3. Tạo File Environment
```bash
# Tạo file .env
echo 'VITE_GOOGLE_CLIENT_ID=1067056172111-l86f9v8u6o02n4lfhv03agivb0gh4fem.apps.googleusercontent.com' > .env
echo 'VITE_REDIRECT_URI=http://localhost:5173' >> .env
```

### 4. Copy Code Chính
Copy toàn bộ nội dung từ `src/App.tsx` trong dự án gốc vào file `src/App.tsx` của bạn.

### 5. Chạy Dự Án
```bash
npm run dev
```

## Tính Năng Chính

✅ **Google OAuth Login** - Đăng nhập bằng tài khoản Google  
✅ **zkLogin Integration** - Tích hợp Sui zkLogin  
✅ **Transaction Execution** - Thực hiện giao dịch Sui  
✅ **State Persistence** - Lưu trạng thái khi reload  
✅ **Error Handling** - Xử lý lỗi toàn diện  
✅ **Debug Information** - Hiển thị thông tin debug  

## Cấu Trúc Dự Án

```
src/
├── App.tsx          # Component chính
├── main.tsx         # Entry point
├── index.css        # Styles
└── vite-env.d.ts    # Type definitions
```

## Customization

### Thay đổi constants trong App.tsx:
```typescript
const CLIENT_ID = "your-google-client-id";
const TRANSFER_AMOUNT = 1n; // Số SUI muốn chuyển
const RECIPIENT_ADDRESS = "0x..."; // Địa chỉ nhận
```

### Styling:
- Sử dụng Tailwind CSS classes
- Tùy chỉnh màu sắc và layout trong JSX

## Troubleshooting

**Lỗi thường gặp:**
1. **JWT Invalid**: Kiểm tra Google OAuth setup
2. **Network Error**: Đảm bảo kết nối internet ổn định  
3. **Transaction Failed**: Kiểm tra balance và recipient address

**Debug:**
- Mở Developer Tools → Console để xem logs
- Click "Debug Information" để xem chi tiết state
- Kiểm tra Network tab để xem API calls

## Next Steps

1. **Setup Google OAuth riêng**: Tạo Client ID của bạn
2. **Deploy**: Build và deploy lên Vercel/Netlify
3. **Customize UI**: Thay đổi giao diện theo ý muốn
4. **Add Features**: Thêm tính năng mới như NFT, multi-sig, etc.

---
**Lưu ý**: Dự án này chạy trên Sui Devnet. Đừng sử dụng mainnet khi đang phát triển! 