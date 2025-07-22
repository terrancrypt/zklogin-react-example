# Hướng Dẫn Tạo Dự Án Sui zkLogin với React + TypeScript

## Tổng Quan Dự Án

Dự án này là một ứng dụng React demonstrating tích hợp Sui zkLogin - một hệ thống xác thực cho phép người dùng đăng nhập bằng Google OAuth và thực hiện giao dịch trên blockchain Sui mà không cần quản lý private key truyền thống.

## Bước 1: Khởi Tạo Dự Án

### 1.1. Tạo dự án React với Vite

```bash
# Tạo dự án mới
npm create vite@latest zklogin-react-example -- --template react-ts

# Hoặc với pnpm
pnpm create vite zklogin-react-example --template react-ts

# Di chuyển vào thư mục dự án
cd zklogin-react-example
```

### 1.2. Cài đặt dependencies

```bash
# Cài đặt các package cần thiết
npm install @mysten/sui@^1.36.1 @tailwindcss/vite@^4.1.11 axios@^1.10.0 jwt-decode@^4.0.0 query-string@^9.2.2 tailwindcss@^4.1.11

# Hoặc với pnpm
pnpm add @mysten/sui@^1.36.1 @tailwindcss/vite@^4.1.11 axios@^1.10.0 jwt-decode@^4.0.0 query-string@^9.2.2 tailwindcss@^4.1.11
```

### 1.3. Cài đặt dev dependencies

```bash
# Với npm
npm install -D @vitejs/plugin-react-swc

# Với pnpm
pnpm add -D @vitejs/plugin-react-swc
```

## Bước 2: Cấu Hình Dự Án

### 2.1. Cập nhật `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### 2.2. Cập nhật `src/index.css`

```css
@import "tailwindcss";
```

### 2.3. Tạo file `.env` (không commit vào git)

```env
# Google OAuth Client ID - Thay thế bằng client ID của bạn
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Sui Network URLs
VITE_FULLNODE_URL=https://fullnode.devnet.sui.io
VITE_PROVER_URL=https://prover-dev.mystenlabs.com/v1

# App Configuration
VITE_REDIRECT_URI=http://localhost:5173
```

### 2.4. Tạo file `.gitignore`

```gitignore
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

## Bước 3: Tạo Các Constants và Types

### 3.1. Tạo file `src/constants.ts`

```typescript
// Google OAuth Configuration
export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 
  "1067056172111-l86f9v8u6o02n4lfhv03agivb0gh4fem.apps.googleusercontent.com";

export const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || "http://localhost:5173";

// Sui Network Configuration
export const FULLNODE_URL = import.meta.env.VITE_FULLNODE_URL || "https://fullnode.devnet.sui.io";
export const SUI_PROVER_DEV_ENDPOINT = import.meta.env.VITE_PROVER_URL || "https://prover-dev.mystenlabs.com/v1";

// Transaction Configuration
export const TRANSFER_AMOUNT = 1n; // Amount in SUI to transfer
export const RECIPIENT_ADDRESS = "0xfa0f8542f256e669694624aa3ee7bfbde5af54641646a3a05924cf9e329a8a36";

// Storage Keys
export const STORAGE_KEYS = {
  EPHEMERAL_KEY_PAIR: "ephemeralKeyPair",
  RANDOMNESS: "randomness", 
  SALT: "zkloginSalt",
  NONCE: "zkloginNonce",
  JWT_TOKEN: "jwtString",
  ZK_ADDRESS: "zkLoginAddress"
} as const;
```

### 3.2. Tạo file `src/types.ts`

```typescript
import { JwtPayload } from "jwt-decode";

export interface ZkLoginState {
  loading: boolean;
  error?: string;
  jwtString: string;
  decodedJwt?: JwtPayload;
  ephemeralKeyPair?: any;
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

export interface ProverAPIPayload {
  jwt: string;
  extendedEphemeralPublicKey: string;
  maxEpoch: number;
  jwtRandomness: string;
  salt: string;
  keyClaimName: string;
}
```

## Bước 4: Tạo Utility Functions

### 4.1. Tạo file `src/utils/auth.ts`

```typescript
import { SUI_PROVER_DEV_ENDPOINT, CLIENT_ID, REDIRECT_URI } from '../constants';

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

export const callProverAPI = async (payload: any) => {
  const response = await fetch(SUI_PROVER_DEV_ENDPOINT, {
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

export const buildGoogleAuthUrl = (nonce: string): string => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "id_token",
    scope: "openid",
    nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};
```

### 4.2. Tạo file `src/utils/storage.ts`

```typescript
import { STORAGE_KEYS } from '../constants';

export const storage = {
  // Session Storage
  setSessionItem: (key: string, value: string) => {
    sessionStorage.setItem(key, value);
  },
  
  getSessionItem: (key: string): string | null => {
    return sessionStorage.getItem(key);
  },
  
  removeSessionItem: (key: string) => {
    sessionStorage.removeItem(key);
  },
  
  // Local Storage
  setLocalItem: (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  
  getLocalItem: (key: string): string | null => {
    return localStorage.getItem(key);
  },
  
  removeLocalItem: (key: string) => {
    localStorage.removeItem(key);
  },
  
  // Clear all zkLogin related data
  clearAll: () => {
    // Clear session storage
    sessionStorage.removeItem(STORAGE_KEYS.EPHEMERAL_KEY_PAIR);
    sessionStorage.removeItem(STORAGE_KEYS.RANDOMNESS);
    sessionStorage.removeItem(STORAGE_KEYS.NONCE);
    
    // Clear local storage
    localStorage.removeItem(STORAGE_KEYS.JWT_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ZK_ADDRESS);
    localStorage.removeItem(STORAGE_KEYS.SALT);
  }
};
```

## Bước 5: Tạo Custom Hooks

### 5.1. Tạo file `src/hooks/useZkLogin.ts`

```typescript
import { useState, useEffect } from 'react';
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
  genAddressSeed,
} from "@mysten/sui/zklogin";
import { SuiClient } from "@mysten/sui/client";
import { jwtDecode, type JwtPayload } from "jwt-decode";
import { Transaction } from "@mysten/sui/transactions";
import { MIST_PER_SUI } from "@mysten/sui/utils";

import { FULLNODE_URL, TRANSFER_AMOUNT, RECIPIENT_ADDRESS, STORAGE_KEYS } from '../constants';
import { ZkLoginState } from '../types';
import { parseUrlHash, callProverAPI, buildGoogleAuthUrl } from '../utils/auth';
import { storage } from '../utils/storage';

export const useZkLogin = () => {
  const [state, setState] = useState<ZkLoginState>({
    loading: false,
    error: undefined,
    jwtString: "",
    decodedJwt: undefined,
    ephemeralKeyPair: undefined,
    randomness: "",
    salt: "",
    nonce: "",
    zkLoginUserAddress: "",
    extendedEphemeralPublicKey: "",
    zkProof: undefined,
    executeDigest: "",
    isZkLoginReady: false,
    isExecutingTransaction: false,
  });

  const suiClient = new SuiClient({ url: FULLNODE_URL });

  // Restore data on component mount
  useEffect(() => {
    const restoreData = () => {
      // Restore JWT
      const storedJwt = storage.getLocalItem(STORAGE_KEYS.JWT_TOKEN);
      if (storedJwt) {
        setState(prev => ({ ...prev, jwtString: storedJwt }));
        try {
          setState(prev => ({ ...prev, decodedJwt: jwtDecode(storedJwt) }));
        } catch {
          setState(prev => ({ ...prev, error: "Stored JWT is invalid" }));
        }
      }

      // Restore ephemeral key pair
      const storedKey = storage.getSessionItem(STORAGE_KEYS.EPHEMERAL_KEY_PAIR);
      if (storedKey) {
        try {
          setState(prev => ({ 
            ...prev, 
            ephemeralKeyPair: Ed25519Keypair.fromSecretKey(storedKey) 
          }));
        } catch {
          storage.removeSessionItem(STORAGE_KEYS.EPHEMERAL_KEY_PAIR);
        }
      }

      // Restore other data
      const storedRandomness = storage.getSessionItem(STORAGE_KEYS.RANDOMNESS);
      if (storedRandomness) {
        setState(prev => ({ ...prev, randomness: storedRandomness }));
      }

      const storedSalt = storage.getLocalItem(STORAGE_KEYS.SALT);
      if (storedSalt) {
        setState(prev => ({ ...prev, salt: storedSalt }));
      }

      const storedNonce = storage.getSessionItem(STORAGE_KEYS.NONCE);
      if (storedNonce) {
        setState(prev => ({ ...prev, nonce: storedNonce }));
      }

      const storedAddress = storage.getLocalItem(STORAGE_KEYS.ZK_ADDRESS);
      if (storedAddress) {
        setState(prev => ({ ...prev, zkLoginUserAddress: storedAddress }));
      }

      // Handle URL params (after Google OAuth redirect)
      const urlParams = parseUrlHash();
      if (urlParams.id_token) {
        setState(prev => ({ ...prev, jwtString: urlParams.id_token }));
        storage.setLocalItem(STORAGE_KEYS.JWT_TOKEN, urlParams.id_token);
        try {
          setState(prev => ({ ...prev, decodedJwt: jwtDecode(urlParams.id_token) }));
        } catch {
          setState(prev => ({ ...prev, error: "Invalid JWT token received" }));
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    restoreData();
  }, []);

  // Setup zkLogin when all required data is available
  useEffect(() => {
    const setupZkLogin = async () => {
      if (
        !state.jwtString ||
        !state.decodedJwt ||
        !state.ephemeralKeyPair ||
        !state.randomness ||
        !state.salt
      ) return;

      setState(prev => ({ ...prev, loading: true, error: undefined }));

      try {
        const address = jwtToAddress(state.jwtString, state.salt);
        setState(prev => ({ ...prev, zkLoginUserAddress: address }));
        storage.setLocalItem(STORAGE_KEYS.ZK_ADDRESS, address);

        const extPubKey = getExtendedEphemeralPublicKey(
          state.ephemeralKeyPair.getPublicKey()
        );
        setState(prev => ({ ...prev, extendedEphemeralPublicKey: extPubKey }));

        const { epoch } = await suiClient.getLatestSuiSystemState();
        const maxEpoch = Number(epoch) + 2;

        const zkProofData = await callProverAPI({
          jwt: state.jwtString,
          extendedEphemeralPublicKey: extPubKey,
          maxEpoch,
          jwtRandomness: state.randomness,
          salt: state.salt,
          keyClaimName: "sub",
        });

        setState(prev => ({ 
          ...prev, 
          zkProof: zkProofData, 
          isZkLoginReady: true 
        }));
      } catch (e) {
        setState(prev => ({ 
          ...prev, 
          error: `zkLogin setup error: ${e instanceof Error ? e.message : String(e)}` 
        }));
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    setupZkLogin();
  }, [state.jwtString, state.decodedJwt, state.ephemeralKeyPair, state.randomness, state.salt]);

  const handleLoginWithGoogle = async () => {
    setState(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const newEphemeralKeyPair = Ed25519Keypair.generate();
      storage.setSessionItem(STORAGE_KEYS.EPHEMERAL_KEY_PAIR, newEphemeralKeyPair.getSecretKey());
      setState(prev => ({ ...prev, ephemeralKeyPair: newEphemeralKeyPair }));

      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 2;

      const newRandomness = generateRandomness();
      storage.setSessionItem(STORAGE_KEYS.RANDOMNESS, newRandomness);
      setState(prev => ({ ...prev, randomness: newRandomness }));

      let currentSalt = state.salt;
      if (!currentSalt) {
        currentSalt = generateRandomness();
        storage.setLocalItem(STORAGE_KEYS.SALT, currentSalt);
        setState(prev => ({ ...prev, salt: currentSalt }));
      }

      const newNonce = generateNonce(
        newEphemeralKeyPair.getPublicKey(),
        maxEpoch,
        newRandomness
      );
      storage.setSessionItem(STORAGE_KEYS.NONCE, newNonce);
      setState(prev => ({ ...prev, nonce: newNonce }));

      const authUrl = buildGoogleAuthUrl(newNonce);
      window.location.replace(authUrl);
    } catch (e) {
      setState(prev => ({ 
        ...prev, 
        error: `Login error: ${e instanceof Error ? e.message : String(e)}`,
        loading: false 
      }));
    }
  };

  const handleExecuteTransaction = async () => {
    if (!state.zkProof || !state.decodedJwt || !state.ephemeralKeyPair || !state.zkLoginUserAddress) {
      setState(prev => ({ ...prev, error: "zkLogin not ready for transaction execution" }));
      return;
    }

    setState(prev => ({ ...prev, isExecutingTransaction: true, error: undefined }));

    try {
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 2;

      const txb = new Transaction();
      const [coin] = txb.splitCoins(txb.gas, [MIST_PER_SUI * TRANSFER_AMOUNT]);
      txb.transferObjects([coin], RECIPIENT_ADDRESS);
      txb.setSender(state.zkLoginUserAddress);

      const { bytes, signature: userSignature } = await txb.sign({
        client: suiClient,
        signer: state.ephemeralKeyPair,
      });

      if (!state.decodedJwt.sub || !state.decodedJwt.aud) {
        throw new Error("JWT missing required claims (sub or aud)");
      }

      const addressSeed = genAddressSeed(
        BigInt(state.salt),
        "sub",
        state.decodedJwt.sub,
        state.decodedJwt.aud as string
      ).toString();

      const zkLoginSignature = getZkLoginSignature({
        inputs: { ...state.zkProof, addressSeed },
        maxEpoch,
        userSignature,
      });

      const executeRes = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
      });

      setState(prev => ({ ...prev, executeDigest: executeRes.digest }));
    } catch (e) {
      setState(prev => ({ 
        ...prev, 
        error: `Transaction execution error: ${e instanceof Error ? e.message : String(e)}` 
      }));
    } finally {
      setState(prev => ({ ...prev, isExecutingTransaction: false }));
    }
  };

  const handleReset = () => {
    try {
      storage.clearAll();
      setState({
        loading: false,
        error: undefined,
        jwtString: "",
        decodedJwt: undefined,
        ephemeralKeyPair: undefined,
        randomness: "",
        salt: "",
        nonce: "",
        zkLoginUserAddress: "",
        extendedEphemeralPublicKey: "",
        zkProof: undefined,
        executeDigest: "",
        isZkLoginReady: false,
        isExecutingTransaction: false,
      });
    } catch (e) {
      setState(prev => ({ 
        ...prev, 
        error: `Reset error: ${e instanceof Error ? e.message : String(e)}` 
      }));
    }
  };

  return {
    ...state,
    handleLoginWithGoogle,
    handleExecuteTransaction,
    handleReset,
  };
};
```

## Bước 6: Tạo Components

### 6.1. Tạo file `src/components/LoginButton.tsx`

```typescript
import React from 'react';

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
      {loading ? "Initializing..." : "Login with Google"}
    </button>
  );
};
```

### 6.2. Tạo file `src/components/TransactionButton.tsx`

```typescript
import React from 'react';
import { TRANSFER_AMOUNT } from '../constants';

interface TransactionButtonProps {
  onExecute: () => void;
  isExecuting: boolean;
  disabled?: boolean;
}

export const TransactionButton: React.FC<TransactionButtonProps> = ({ 
  onExecute, 
  isExecuting, 
  disabled = false 
}) => {
  return (
    <button
      className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={onExecute}
      disabled={isExecuting || disabled}
    >
      {isExecuting ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Processing Transaction...</span>
        </div>
      ) : (
        `Send ${TRANSFER_AMOUNT} SUI`
      )}
    </button>
  );
};
```

### 6.3. Tạo file `src/components/ErrorDisplay.tsx`

```typescript
import React from 'react';

interface ErrorDisplayProps {
  error: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  return (
    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="text-red-800 font-medium">Error:</div>
      <div className="text-red-600 mt-1">{error}</div>
    </div>
  );
};
```

### 6.4. Tạo file `src/components/StatusCard.tsx`

```typescript
import React from 'react';

interface StatusCardProps {
  title: string;
  children: React.ReactNode;
}

export const StatusCard: React.FC<StatusCardProps> = ({ title, children }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
};
```

### 6.5. Tạo file `src/components/DebugInfo.tsx`

```typescript
import React from 'react';
import { ZkLoginState } from '../types';

interface DebugInfoProps {
  state: ZkLoginState;
}

export const DebugInfo: React.FC<DebugInfoProps> = ({ state }) => {
  return (
    <details className="bg-white rounded-lg shadow">
      <summary className="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-50">
        Debug Information (Click to expand)
      </summary>
      <div className="p-4 border-t space-y-4 text-xs">
        <div>
          <div className="font-medium mb-1">Ephemeral Keypair:</div>
          <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
            {state.ephemeralKeyPair
              ? JSON.stringify(
                  {
                    publicKey: state.ephemeralKeyPair.getPublicKey().toBase64(),
                    secretKey: Array.from(state.ephemeralKeyPair.getSecretKey())
                      .map((x: number) => x.toString().padStart(2, "0"))
                      .join(""),
                  },
                  null,
                  2
                )
              : "(not set)"}
          </pre>
        </div>

        <div>
          <div className="font-medium mb-1">Randomness:</div>
          <code className="bg-gray-100 p-1 rounded">
            {state.randomness || "(not set)"}
          </code>
        </div>

        <div>
          <div className="font-medium mb-1">Salt:</div>
          <code className="bg-gray-100 p-1 rounded">
            {state.salt || "(not set)"}
          </code>
        </div>

        <div>
          <div className="font-medium mb-1">Nonce:</div>
          <code className="bg-gray-100 p-1 rounded">
            {state.nonce || "(not set)"}
          </code>
        </div>

        {state.extendedEphemeralPublicKey && (
          <div>
            <div className="font-medium mb-1">Extended Ephemeral Public Key:</div>
            <pre className="bg-gray-100 p-2 rounded overflow-x-auto break-all">
              {state.extendedEphemeralPublicKey}
            </pre>
          </div>
        )}

        {state.decodedJwt && (
          <div>
            <div className="font-medium mb-1">Decoded JWT:</div>
            <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(state.decodedJwt, null, 2)}
            </pre>
          </div>
        )}

        {state.zkProof && (
          <div>
            <div className="font-medium mb-1">zkProof:</div>
            <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(state.zkProof, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
};
```

## Bước 7: Cập Nhật App Component

### 7.1. Cập nhật `src/App.tsx`

```typescript
import React from 'react';
import { useZkLogin } from './hooks/useZkLogin';
import { LoginButton } from './components/LoginButton';
import { TransactionButton } from './components/TransactionButton';
import { ErrorDisplay } from './components/ErrorDisplay';
import { StatusCard } from './components/StatusCard';
import { DebugInfo } from './components/DebugInfo';

function App() {
  const {
    loading,
    error,
    jwtString,
    zkLoginUserAddress,
    executeDigest,
    isZkLoginReady,
    isExecutingTransaction,
    handleLoginWithGoogle,
    handleExecuteTransaction,
    handleReset,
    ...debugState
  } = useZkLogin();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="flex items-center gap-4 px-6 py-4 bg-white shadow">
        <h1 className="text-2xl font-bold text-gray-800">
          Sui zkLogin Example
        </h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          {!jwtString ? (
            <LoginButton onLogin={handleLoginWithGoogle} loading={loading} />
          ) : (
            <div className="space-y-4">
              {loading && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span>Setting up zkLogin...</span>
                </div>
              )}

              {isZkLoginReady && !executeDigest && (
                <div className="space-y-2">
                  <div className="text-green-700 font-medium">
                    ✅ zkLogin setup complete!
                  </div>
                  <TransactionButton 
                    onExecute={handleExecuteTransaction}
                    isExecuting={isExecutingTransaction}
                  />
                </div>
              )}

              {executeDigest && (
                <div className="text-green-700 font-medium">
                  ✅ Transaction successful!
                </div>
              )}

              <button
                className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                onClick={handleReset}
                disabled={loading || isExecutingTransaction}
              >
                Reset/Logout
              </button>
            </div>
          )}
        </div>

        {error && <ErrorDisplay error={error} />}

        {/* Status Information */}
        <div className="w-full max-w-4xl space-y-4">
          {zkLoginUserAddress && (
            <StatusCard title="zkLogin Address">
              <code className="text-sm bg-gray-100 p-2 rounded block break-all">
                {zkLoginUserAddress}
              </code>
            </StatusCard>
          )}

          {executeDigest && (
            <StatusCard title="Transaction">
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-600">Digest: </span>
                  <code className="text-sm bg-gray-100 p-1 rounded">
                    {executeDigest}
                  </code>
                </div>
                <a
                  href={`https://suiexplorer.com/txblock/${executeDigest}?network=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-blue-600 hover:text-blue-800 underline"
                >
                  View on Sui Explorer →
                </a>
              </div>
            </StatusCard>
          )}

          <DebugInfo state={{
            loading,
            error,
            jwtString,
            zkLoginUserAddress,
            executeDigest,
            isZkLoginReady,
            isExecutingTransaction,
            ...debugState
          }} />
        </div>
      </main>
    </div>
  );
}

export default App;
```

## Bước 8: Thiết Lập Google OAuth

### 8.1. Tạo Google OAuth Client ID

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Bật Google+ API
4. Vào "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Chọn "Web application"
6. Thêm `http://localhost:5173` vào "Authorized redirect URIs"
7. Copy Client ID và thay thế trong file `.env`

### 8.2. Cập nhật file `.env`

```env
VITE_GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
VITE_FULLNODE_URL=https://fullnode.devnet.sui.io
VITE_PROVER_URL=https://prover-dev.mystenlabs.com/v1
VITE_REDIRECT_URI=http://localhost:5173
```

## Bước 9: Chạy Dự Án

### 9.1. Cài đặt dependencies

```bash
npm install
# hoặc
pnpm install
```

### 9.2. Chạy development server

```bash
npm run dev
# hoặc
pnpm dev
```

### 9.3. Mở trình duyệt

Truy cập `http://localhost:5173` để test ứng dụng.

## Bước 10: Build và Deploy

### 10.1. Build production

```bash
npm run build
# hoặc
pnpm build
```

### 10.2. Preview production build

```bash
npm run preview
# hoặc
pnpm preview
```

## Cấu Trúc Thư Mục Cuối Cùng

```
zklogin-react-example/
├── public/
│   └── Sui_Symbol_Sea.svg
├── src/
│   ├── components/
│   │   ├── DebugInfo.tsx
│   │   ├── ErrorDisplay.tsx
│   │   ├── LoginButton.tsx
│   │   ├── StatusCard.tsx
│   │   └── TransactionButton.tsx
│   ├── hooks/
│   │   └── useZkLogin.ts
│   ├── utils/
│   │   ├── auth.ts
│   │   └── storage.ts
│   ├── App.tsx
│   ├── constants.ts
│   ├── index.css
│   ├── main.tsx
│   ├── types.ts
│   └── vite-env.d.ts
├── .env
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── pnpm-lock.yaml
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Lưu Ý Quan Trọng

### Security
- Không commit file `.env` vào git
- Client ID có thể public nhưng nên hạn chế domain
- Chỉ sử dụng trên testnet/devnet khi phát triển

### Customization
- Thay đổi `RECIPIENT_ADDRESS` trong constants.ts
- Điều chỉnh `TRANSFER_AMOUNT` theo nhu cầu
- Cập nhật styling trong các components

### Troubleshooting
- Kiểm tra console log nếu có lỗi
- Đảm bảo Google OAuth đã được cấu hình đúng
- Kiểm tra network connection đến Sui devnet

Dự án này demonstrate đầy đủ flow của Sui zkLogin từ authentication đến transaction execution, với code được tổ chức theo best practices và dễ dàng customize. 