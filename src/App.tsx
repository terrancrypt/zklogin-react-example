import { useEffect, useState } from "react";
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
import { MIST_PER_SUI } from "@mysten/sui/utils";
import { jwtDecode, type JwtPayload } from "jwt-decode";
import { Transaction } from "@mysten/sui/transactions";

// =============================================
// CONSTANTS - Dễ dàng tùy chỉnh
// =============================================

// Google OAuth Configuration
const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "1067056172111-l86f9v8u6o02n4lfhv03agivb0gh4fem.apps.googleusercontent.com";
const REDIRECT_URI =
  import.meta.env.VITE_REDIRECT_URI || "http://localhost:5173";

// Sui Network Configuration
const FULLNODE_URL =
  import.meta.env.VITE_FULLNODE_URL || "https://fullnode.devnet.sui.io";
const SUI_PROVER_DEV_ENDPOINT =
  import.meta.env.VITE_PROVER_URL || "https://prover-dev.mystenlabs.com/v1";

// Transaction Configuration - Thay đổi theo nhu cầu
const TRANSFER_AMOUNT = 1n; // Số SUI sẽ chuyển (1 SUI = 1_000_000_000 MIST)
const RECIPIENT_ADDRESS =
  "0xfa0f8542f256e669694624aa3ee7bfbde5af54641646a3a05924cf9e329a8a36"; // Địa chỉ nhận

// Storage Keys - Khóa lưu trữ dữ liệu
const STORAGE_KEYS = {
  EPHEMERAL_KEY_PAIR: "ephemeralKeyPair",
  RANDOMNESS: "randomness",
  SALT: "zkloginSalt",
  NONCE: "zkloginNonce",
  JWT_TOKEN: "jwtString",
  ZK_ADDRESS: "zkLoginAddress",
} as const;

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [jwtString, setJwtString] = useState("");
  const [decodedJwt, setDecodedJwt] = useState<JwtPayload>();
  const [ephemeralKeyPair, setEphemeralKeyPair] = useState<Ed25519Keypair>();
  const [randomness, setRandomness] = useState("");
  const [salt, setSalt] = useState("");
  const [nonce, setNonce] = useState("");
  const [zkLoginUserAddress, setZkLoginUserAddress] = useState("");
  const [extendedEphemeralPublicKey, setExtendedEphemeralPublicKey] =
    useState("");
  const [zkProof, setZkProof] = useState<any>();
  const [executeDigest, setExecuteDigest] = useState("");
  const [isZkLoginReady, setIsZkLoginReady] = useState(false);
  const [isExecutingTransaction, setIsExecutingTransaction] = useState(false);

  // =============================================
  // KHỞI TẠO SUI CLIENT
  // =============================================
  const suiClient = new SuiClient({ url: FULLNODE_URL });

  const parseUrlHash = () => {
    try {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      return Object.fromEntries(params.entries());
    } catch (e) {
      console.error("Error parsing URL hash:", e);
      return {};
    }
  };

  const callProverAPI = async (payload: any) => {
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

  // =============================================
  // KHÔI PHỤC DỮ LIỆU KHI LOAD LẠI TRANG
  // =============================================
  useEffect(() => {
    // Khôi phục JWT từ localStorage
    const storedJwt = localStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
    if (storedJwt) {
      setJwtString(storedJwt);
      try {
        setDecodedJwt(jwtDecode(storedJwt));
      } catch {
        setError("Stored JWT is invalid");
      }
    }

    // Khôi phục ephemeral keypair
    const storedKey = sessionStorage.getItem(STORAGE_KEYS.EPHEMERAL_KEY_PAIR);
    if (storedKey) {
      try {
        setEphemeralKeyPair(Ed25519Keypair.fromSecretKey(storedKey));
      } catch {
        sessionStorage.removeItem(STORAGE_KEYS.EPHEMERAL_KEY_PAIR);
      }
    }

    // Khôi phục randomness
    const storedRandomness = sessionStorage.getItem(STORAGE_KEYS.RANDOMNESS);
    if (storedRandomness) setRandomness(storedRandomness);

    // Khôi phục salt
    const storedSalt = localStorage.getItem(STORAGE_KEYS.SALT);
    if (storedSalt) setSalt(storedSalt);

    // Khôi phục nonce
    const storedNonce = sessionStorage.getItem(STORAGE_KEYS.NONCE);
    if (storedNonce) setNonce(storedNonce);

    // Khôi phục zkLogin address
    const storedAddress = localStorage.getItem(STORAGE_KEYS.ZK_ADDRESS);
    if (storedAddress) setZkLoginUserAddress(storedAddress);

    // Xử lý token từ URL (sau khi redirect từ Google)
    const urlParams = parseUrlHash();
    if (urlParams.id_token) {
      setJwtString(urlParams.id_token);
      localStorage.setItem(STORAGE_KEYS.JWT_TOKEN, urlParams.id_token);
      try {
        setDecodedJwt(jwtDecode(urlParams.id_token));
      } catch {
        setError("Invalid JWT token received");
      }
      // Clear URL hash
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // =============================================
  // XỬ LÝ ĐĂNG NHẬP GOOGLE
  // =============================================
  const handleLoginWithGoogle = async () => {
    setLoading(true);
    setError(undefined);

    try {
      // Tạo ephemeral keypair mới
      const newEphemeralKeyPair = Ed25519Keypair.generate();
      sessionStorage.setItem(
        STORAGE_KEYS.EPHEMERAL_KEY_PAIR,
        newEphemeralKeyPair.getSecretKey()
      );
      setEphemeralKeyPair(newEphemeralKeyPair);

      // Lấy epoch hiện tại
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 2;

      // Tạo randomness
      const newRandomness = generateRandomness();
      sessionStorage.setItem(STORAGE_KEYS.RANDOMNESS, newRandomness);
      setRandomness(newRandomness);

      // Tạo hoặc lấy salt
      let currentSalt = salt;
      if (!currentSalt) {
        currentSalt = generateRandomness();
        localStorage.setItem(STORAGE_KEYS.SALT, currentSalt);
        setSalt(currentSalt);
      }

      // Tạo nonce
      const newNonce = generateNonce(
        newEphemeralKeyPair.getPublicKey(),
        maxEpoch,
        newRandomness
      );
      sessionStorage.setItem(STORAGE_KEYS.NONCE, newNonce);
      setNonce(newNonce);

      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "id_token",
        scope: "openid",
        nonce: newNonce,
      });

      window.location.replace(
        `https://accounts.google.com/o/oauth2/v2/auth?${params}`
      );
    } catch (e) {
      setError(`Login error: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  };

  // =============================================
  // SETUP ZKLOGIN SAU KHI CÓ JWT
  // =============================================
  useEffect(() => {
    const setupZkLogin = async () => {
      // Kiểm tra tất cả dữ liệu cần thiết
      if (
        !jwtString ||
        !decodedJwt ||
        !ephemeralKeyPair ||
        !randomness ||
        !salt
      ) {
        return;
      }

      setLoading(true);
      setError(undefined);

      try {
        // Tính toán zkLogin address
        const address = jwtToAddress(jwtString, salt);
        setZkLoginUserAddress(address);
        localStorage.setItem(STORAGE_KEYS.ZK_ADDRESS, address);

        const extPubKey = getExtendedEphemeralPublicKey(
          ephemeralKeyPair.getPublicKey()
        );
        setExtendedEphemeralPublicKey(extPubKey);

        const { epoch } = await suiClient.getLatestSuiSystemState();
        const maxEpoch = Number(epoch) + 2;

        const zkProofData = await callProverAPI({
          jwt: jwtString,
          extendedEphemeralPublicKey: extPubKey,
          maxEpoch,
          jwtRandomness: randomness,
          salt,
          keyClaimName: "sub",
        });
        setZkProof(zkProofData);
        setIsZkLoginReady(true);
      } catch (e) {
        setError(
          `zkLogin setup error: ${e instanceof Error ? e.message : String(e)}`
        );
      } finally {
        setLoading(false);
      }
    };

    setupZkLogin();
  }, [jwtString, decodedJwt, ephemeralKeyPair, randomness, salt]);

  // Function to execute transaction manually
  const handleExecuteTransaction = async () => {
    if (!zkProof || !decodedJwt || !ephemeralKeyPair || !zkLoginUserAddress) {
      setError("zkLogin not ready for transaction execution");
      return;
    }

    setIsExecutingTransaction(true);
    setError(undefined);

    try {
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 2;

      const txb = new Transaction();
      const [coin] = txb.splitCoins(txb.gas, [MIST_PER_SUI * TRANSFER_AMOUNT]);
      txb.transferObjects([coin], RECIPIENT_ADDRESS);
      txb.setSender(zkLoginUserAddress);

      const { bytes, signature: userSignature } = await txb.sign({
        client: suiClient,
        signer: ephemeralKeyPair,
      });

      if (!decodedJwt.sub || !decodedJwt.aud) {
        throw new Error("JWT missing required claims (sub or aud)");
      }

      const addressSeed = genAddressSeed(
        BigInt(salt),
        "sub",
        decodedJwt.sub,
        decodedJwt.aud as string
      ).toString();

      const zkLoginSignature = getZkLoginSignature({
        inputs: { ...zkProof, addressSeed },
        maxEpoch,
        userSignature,
      });

      const executeRes = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
      });

      setExecuteDigest(executeRes.digest);
    } catch (e) {
      setError(
        `Transaction execution error: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    } finally {
      setIsExecutingTransaction(false);
    }
  };

  // =============================================
  // XỬ LÝ RESET/LOGOUT
  // =============================================
  const handleReset = () => {
    try {
      // Xóa session storage
      sessionStorage.removeItem(STORAGE_KEYS.EPHEMERAL_KEY_PAIR);
      sessionStorage.removeItem(STORAGE_KEYS.RANDOMNESS);
      sessionStorage.removeItem(STORAGE_KEYS.NONCE);

      // Xóa local storage
      localStorage.removeItem(STORAGE_KEYS.JWT_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ZK_ADDRESS);

      setEphemeralKeyPair(undefined);
      setRandomness("");
      setNonce("");
      setJwtString("");
      setDecodedJwt(undefined);
      setZkLoginUserAddress("");
      setExtendedEphemeralPublicKey("");
      setZkProof(undefined);
      setExecuteDigest("");
      setError(undefined);
      setLoading(false);
      setIsZkLoginReady(false);
      setIsExecutingTransaction(false);
    } catch (e) {
      setError(`Reset error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* =============================================
          HEADER
          ============================================= */}
      <header className="flex items-center gap-4 px-6 py-4 bg-white shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Sui zkLogin Demo
            </h1>
            <p className="text-sm text-gray-600">
              Đăng nhập với Google + Blockchain Sui
            </p>
          </div>
        </div>
      </header>

      {/* =============================================
          MAIN CONTENT
          ============================================= */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* =============================================
            AUTHENTICATION SECTION
            ============================================= */}
        <div className="text-center mb-8">
          {!jwtString ? (
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Bước 1: Đăng Nhập
                </h2>
                <p className="text-gray-600">
                  Sử dụng tài khoản Google để bắt đầu
                </p>
              </div>
              <button
                className="px-8 py-4 rounded-lg bg-blue-600 text-white font-semibold text-lg shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 mx-auto"
                onClick={handleLoginWithGoogle}
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? "Đang khởi tạo..." : "Đăng nhập với Google"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Loading State */}
              {loading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <div>
                      <div className="font-medium text-blue-800">
                        Bước 2: Thiết lập zkLogin
                      </div>
                      <div className="text-sm text-blue-600">
                        Đang tạo địa chỉ blockchain...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* zkLogin Ready State */}
              {isZkLoginReady && !executeDigest && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-2xl">✅</span>
                      <div>
                        <div className="font-medium text-green-800">
                          zkLogin đã sẵn sàng!
                        </div>
                        <div className="text-sm text-green-600">
                          Bây giờ bạn có thể thực hiện giao dịch
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Bước 3: Thực hiện giao dịch
                    </h3>
                    <button
                      className="px-8 py-3 rounded-lg bg-green-600 text-white font-semibold shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                      onClick={handleExecuteTransaction}
                      disabled={isExecutingTransaction}
                    >
                      {isExecutingTransaction ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Đang xử lý giao dịch...</span>
                        </>
                      ) : (
                        <>
                          <span>💰</span>
                          <span>Chuyển {TRANSFER_AMOUNT} SUI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Success State */}
              {executeDigest && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <div className="font-medium text-green-800">
                        Giao dịch thành công!
                      </div>
                      <div className="text-sm text-green-600">
                        Kiểm tra kết quả bên dưới
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 text-sm"
                  onClick={handleReset}
                  disabled={loading || isExecutingTransaction}
                >
                  🔄 Reset/Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =============================================
            ERROR DISPLAY
            ============================================= */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="text-red-500 text-xl">⚠️</span>
              <div>
                <div className="text-red-800 font-medium">Có lỗi xảy ra:</div>
                <div className="text-red-600 mt-1 text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* =============================================
            STATUS INFORMATION
            ============================================= */}
        <div className="w-full max-w-4xl space-y-4">
          {zkLoginUserAddress && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xl">🏠</span>
                <h3 className="font-semibold text-gray-800">
                  Địa chỉ zkLogin của bạn
                </h3>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <code className="text-sm text-gray-700 break-all block">
                  {zkLoginUserAddress}
                </code>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Đây là địa chỉ blockchain được tạo từ tài khoản Google của
                bạn
              </p>
            </div>
          )}

          {executeDigest && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xl">📋</span>
                <h3 className="font-semibold text-gray-800">
                  Thông tin giao dịch
                </h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">
                    Transaction Hash:
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <code className="text-xs text-gray-700 break-all block">
                      {executeDigest}
                    </code>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <a
                    href={`https://suiexplorer.com/txblock/${executeDigest}?network=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <span>🔍</span>
                    <span>Xem trên Sui Explorer</span>
                  </a>
                  <div className="text-xs text-gray-500">
                    💡 Click để xem chi tiết giao dịch trên blockchain
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================
              DEBUG INFORMATION
              ============================================= */}
          <details className="bg-white rounded-lg shadow-sm border">
            <summary className="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-50 flex items-center space-x-2">
              <span>🔧</span>
              <span>Thông tin Debug (Click để xem chi tiết)</span>
            </summary>
            <div className="p-4 border-t space-y-4 text-xs">
              <div>
                <div className="font-medium mb-1">Ephemeral Keypair:</div>
                <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                  {ephemeralKeyPair
                    ? JSON.stringify(
                        {
                          publicKey: ephemeralKeyPair.getPublicKey().toBase64(),
                          secretKey: Array.from(ephemeralKeyPair.getSecretKey())
                            .map((x) => x.toString().padStart(2, "0"))
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
                  {randomness || "(not set)"}
                </code>
              </div>

              <div>
                <div className="font-medium mb-1">Salt:</div>
                <code className="bg-gray-100 p-1 rounded">
                  {salt || "(not set)"}
                </code>
              </div>

              <div>
                <div className="font-medium mb-1">Nonce:</div>
                <code className="bg-gray-100 p-1 rounded">
                  {nonce || "(not set)"}
                </code>
              </div>

              {extendedEphemeralPublicKey && (
                <div>
                  <div className="font-medium mb-1">
                    Extended Ephemeral Public Key:
                  </div>
                  <pre className="bg-gray-100 p-2 rounded overflow-x-auto break-all">
                    {extendedEphemeralPublicKey}
                  </pre>
                </div>
              )}

              {decodedJwt && (
                <div>
                  <div className="font-medium mb-1">Decoded JWT:</div>
                  <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(decodedJwt, null, 2)}
                  </pre>
                </div>
              )}

              {zkProof && (
                <div>
                  <div className="font-medium mb-1">zkProof:</div>
                  <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(zkProof, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}

export default App;
