# Phân Tách Code - Refactor Dự Án zkLogin

## Tổng Quan
File `App.tsx` hiện tại có 504 dòng code. Để dễ maintain và scale, chúng ta sẽ phân tách thành các modules nhỏ hơn.

## Cấu Trúc Thư Mục Mới

```
src/
├── components/           # UI Components
│   ├── LoginButton.tsx
│   ├── TransactionButton.tsx
│   ├── ErrorDisplay.tsx
│   ├── StatusCard.tsx
│   ├── DebugInfo.tsx
│   └── LoadingSpinner.tsx
├── hooks/               # Custom Hooks
│   ├── useZkLogin.ts
│   └── useStorage.ts
├── utils/               # Utility Functions
│   ├── auth.ts
│   ├── storage.ts
│   ├── transaction.ts
│   └── validation.ts
├── constants/           # Constants
│   ├── config.ts
│   ├── storage-keys.ts
│   └── endpoints.ts
├── types/               # TypeScript Types
│   ├── zklogin.ts
│   └── api.ts
├── services/            # API Services
│   ├── suiClient.ts
│   ├── proverApi.ts
│   └── googleAuth.ts
├── App.tsx              # Main App (simplified)
├── main.tsx
└── index.css
```

## Bước 1: Tạo Constants

### `src/constants/config.ts`
```typescript
export const APP_CONFIG = {
  CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || 
    "1067056172111-l86f9v8u6o02n4lfhv03agivb0gh4fem.apps.googleusercontent.com",
  REDIRECT_URI: import.meta.env.VITE_REDIRECT_URI || "http://localhost:5173",
  TRANSFER_AMOUNT: 1n,
  RECIPIENT_ADDRESS: "0xfa0f8542f256e669694624aa3ee7bfbde5af54641646a3a05924cf9e329a8a36"
} as const;
```

### `src/constants/endpoints.ts`
```typescript
export const ENDPOINTS = {
  FULLNODE_URL: import.meta.env.VITE_FULLNODE_URL || "https://fullnode.devnet.sui.io",
  PROVER_URL: import.meta.env.VITE_PROVER_URL || "https://prover-dev.mystenlabs.com/v1",
  GOOGLE_AUTH: "https://accounts.google.com/o/oauth2/v2/auth"
} as const;
```

### `src/constants/storage-keys.ts`
```typescript
export const STORAGE_KEYS = {
  EPHEMERAL_KEY_PAIR: "ephemeralKeyPair",
  RANDOMNESS: "randomness",
  SALT: "zkloginSalt",
  NONCE: "zkloginNonce",
  JWT_TOKEN: "jwtString",
  ZK_ADDRESS: "zkLoginAddress"
} as const;
```

## Bước 2: Tạo Types

### `src/types/zklogin.ts`
```typescript
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { JwtPayload } from "jwt-decode";

export interface ZkLoginState {
  loading: boolean;
  error?: string;
  jwtString: string;
  decodedJwt?: JwtPayload;
  ephemeralKeyPair?: Ed25519Keypair;
  randomness: string;
  salt: string;
  nonce: string;
  zkLoginUserAddress: string;
  extendedEphemeralPublicKey: string;
  zkProof?: any;
  executeDigest: string;
  isZkLoginReady: boolean;
  isExecutingTransaction: boolean;
}

export interface ZkLoginActions {
  handleLoginWithGoogle: () => Promise<void>;
  handleExecuteTransaction: () => Promise<void>;
  handleReset: () => void;
}
```

### `src/types/api.ts`
```typescript
export interface ProverAPIPayload {
  jwt: string;
  extendedEphemeralPublicKey: string;
  maxEpoch: number;
  jwtRandomness: string;
  salt: string;
  keyClaimName: string;
}

export interface GoogleAuthParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  nonce: string;
}
```

## Bước 3: Tạo Services

### `src/services/suiClient.ts`
```typescript
import { SuiClient } from "@mysten/sui/client";
import { ENDPOINTS } from "../constants/endpoints";

export const suiClient = new SuiClient({ url: ENDPOINTS.FULLNODE_URL });

export const getSuiSystemState = async () => {
  return await suiClient.getLatestSuiSystemState();
};
```

### `src/services/proverApi.ts`
```typescript
import { ENDPOINTS } from "../constants/endpoints";
import { ProverAPIPayload } from "../types/api";

export const callProverAPI = async (payload: ProverAPIPayload) => {
  const response = await fetch(ENDPOINTS.PROVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Prover API error: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
};
```

### `src/services/googleAuth.ts`
```typescript
import { APP_CONFIG, ENDPOINTS } from "../constants/config";
import { GoogleAuthParams } from "../types/api";

export const buildGoogleAuthUrl = (nonce: string): string => {
  const params: GoogleAuthParams = {
    client_id: APP_CONFIG.CLIENT_ID,
    redirect_uri: APP_CONFIG.REDIRECT_URI,
    response_type: "id_token",
    scope: "openid",
    nonce,
  };

  const searchParams = new URLSearchParams(params);
  return `${ENDPOINTS.GOOGLE_AUTH}?${searchParams}`;
};
```

## Bước 4: Tạo Utilities

### `src/utils/storage.ts`
```typescript
import { STORAGE_KEYS } from "../constants/storage-keys";

export const storage = {
  session: {
    set: (key: string, value: string) => sessionStorage.setItem(key, value),
    get: (key: string) => sessionStorage.getItem(key),
    remove: (key: string) => sessionStorage.removeItem(key),
  },
  local: {
    set: (key: string, value: string) => localStorage.setItem(key, value),
    get: (key: string) => localStorage.getItem(key),
    remove: (key: string) => localStorage.removeItem(key),
  },
  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
  }
};
```

### `src/utils/auth.ts`
```typescript
export const parseUrlHash = () => {
  try {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return Object.fromEntries(params.entries());
  } catch (e) {
    console.error("Error parsing URL hash:", e);
    return {};
  }
};

export const clearUrlHash = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};
```

### `src/utils/transaction.ts`
```typescript
import { Transaction } from "@mysten/sui/transactions";
import { MIST_PER_SUI } from "@mysten/sui/utils";
import { APP_CONFIG } from "../constants/config";

export const createTransferTransaction = (senderAddress: string) => {
  const txb = new Transaction();
  const [coin] = txb.splitCoins(txb.gas, [MIST_PER_SUI * APP_CONFIG.TRANSFER_AMOUNT]);
  txb.transferObjects([coin], APP_CONFIG.RECIPIENT_ADDRESS);
  txb.setSender(senderAddress);
  return txb;
};
```

### `src/utils/validation.ts`
```typescript
import { JwtPayload } from "jwt-decode";

export const validateJwtClaims = (jwt: JwtPayload): boolean => {
  return !!(jwt.sub && jwt.aud);
};

export const validateZkLoginReadiness = (
  jwtString: string,
  decodedJwt: JwtPayload | undefined,
  ephemeralKeyPair: any,
  randomness: string,
  salt: string
): boolean => {
  return !!(jwtString && decodedJwt && ephemeralKeyPair && randomness && salt);
};
```

## Bước 5: Tạo Custom Hooks

### `src/hooks/useStorage.ts`
```typescript
import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';

export const useStorage = (key: string, storageType: 'local' | 'session' = 'local') => {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const storedValue = storage[storageType].get(key);
    setValue(storedValue);
  }, [key, storageType]);

  const updateValue = (newValue: string) => {
    storage[storageType].set(key, newValue);
    setValue(newValue);
  };

  const removeValue = () => {
    storage[storageType].remove(key);
    setValue(null);
  };

  return { value, updateValue, removeValue };
};
```

### `src/hooks/useZkLogin.ts` (Simplified)
```typescript
import { useState, useEffect } from 'react';
import { ZkLoginState, ZkLoginActions } from '../types/zklogin';
import { storage } from '../utils/storage';
import { parseUrlHash, clearUrlHash } from '../utils/auth';
// ... other imports

export const useZkLogin = (): ZkLoginState & ZkLoginActions => {
  // Implementation moved from App.tsx
  // Broken down into smaller functions
};
```

## Bước 6: Tạo Components

### `src/components/LoadingSpinner.tsx`
```typescript
interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Loading..." 
}) => {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span>{message}</span>
    </div>
  );
};
```

### `src/components/LoginButton.tsx`
```typescript
import { LoadingSpinner } from './LoadingSpinner';

interface LoginButtonProps {
  onLogin: () => void;
  loading: boolean;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ onLogin, loading }) => {
  return (
    <button
      className="px-8 py-4 rounded-lg bg-blue-600 text-white font-semibold text-lg shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={onLogin}
      disabled={loading}
    >
      {loading ? <LoadingSpinner message="Initializing..." /> : "Login with Google"}
    </button>
  );
};
```

## Bước 7: Refactor App.tsx

### `src/App.tsx` (Simplified)
```typescript
import React from 'react';
import { useZkLogin } from './hooks/useZkLogin';
import { LoginButton } from './components/LoginButton';
import { TransactionButton } from './components/TransactionButton';
import { ErrorDisplay } from './components/ErrorDisplay';
import { StatusCard } from './components/StatusCard';
import { DebugInfo } from './components/DebugInfo';
import { LoadingSpinner } from './components/LoadingSpinner';

function App() {
  const zkLogin = useZkLogin();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="flex items-center gap-4 px-6 py-4 bg-white shadow">
        <h1 className="text-2xl font-bold text-gray-800">
          Sui zkLogin Example
        </h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <AuthSection zkLogin={zkLogin} />
        {zkLogin.error && <ErrorDisplay error={zkLogin.error} />}
        <StatusSection zkLogin={zkLogin} />
      </main>
    </div>
  );
}

// Separate components for better organization
const AuthSection: React.FC<{ zkLogin: any }> = ({ zkLogin }) => {
  // Auth UI logic
};

const StatusSection: React.FC<{ zkLogin: any }> = ({ zkLogin }) => {
  // Status display logic
};

export default App;
```

## Bước 8: Thực Hiện Refactor

### Thứ tự thực hiện:
1. **Tạo constants và types** - Foundation
2. **Tạo services** - External API calls
3. **Tạo utilities** - Pure functions
4. **Tạo hooks** - State logic
5. **Tạo components** - UI components
6. **Refactor App.tsx** - Main component

### Script tự động:
```bash
# Tạo thư mục
mkdir -p src/{components,hooks,utils,constants,types,services}

# Copy code từ App.tsx vào các files tương ứng
# Sử dụng các đoạn code ở trên
```

## Lợi Ích Sau Refactor

✅ **Maintainability** - Dễ maintain và debug  
✅ **Reusability** - Components và hooks có thể tái sử dụng  
✅ **Testability** - Dễ viết unit tests  
✅ **Scalability** - Dễ thêm tính năng mới  
✅ **Readability** - Code dễ đọc và hiểu  
✅ **Type Safety** - TypeScript types rõ ràng  

## Next Steps

1. **Implement Error Boundaries** - Xử lý lỗi global
2. **Add Unit Tests** - Test các utilities và hooks
3. **Performance Optimization** - React.memo, useMemo
4. **Add Storybook** - Document components
5. **Implement State Management** - Zustand/Redux nếu cần 