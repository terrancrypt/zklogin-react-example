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

// Constants for easy customization
const CLIENT_ID =
  "1067056172111-l86f9v8u6o02n4lfhv03agivb0gh4fem.apps.googleusercontent.com";
const REDIRECT_URI = "http://localhost:5173";
const FULLNODE_URL = "https://fullnode.devnet.sui.io";
const SUI_PROVER_DEV_ENDPOINT = "https://prover-dev.mystenlabs.com/v1";
const TRANSFER_AMOUNT = 1n; // Amount in SUI to transfer
const RECIPIENT_ADDRESS =
  "0xfa0f8542f256e669694624aa3ee7bfbde5af54641646a3a05924cf9e329a8a36";

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

  const suiClient = new SuiClient({ url: FULLNODE_URL });

  const KEY_PAIR_SESSION_STORAGE_KEY = "ephemeralKeyPair";
  const RANDOMNESS_SESSION_STORAGE_KEY = "randomness";
  const SALT_LOCAL_STORAGE_KEY = "zkloginSalt";
  const NONCE_SESSION_STORAGE_KEY = "zkloginNonce";

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

  // ✅ Khôi phục dữ liệu khi load lại
  useEffect(() => {
    // Khôi phục jwt từ localStorage
    const storedJwt = localStorage.getItem("jwtString");
    if (storedJwt) {
      setJwtString(storedJwt);
      try {
        setDecodedJwt(jwtDecode(storedJwt));
      } catch {
        setError("Stored JWT is invalid");
      }
    }

    // Khôi phục ephemeralKeyPair
    const storedKey = sessionStorage.getItem(KEY_PAIR_SESSION_STORAGE_KEY);
    if (storedKey) {
      try {
        setEphemeralKeyPair(Ed25519Keypair.fromSecretKey(storedKey));
      } catch {
        sessionStorage.removeItem(KEY_PAIR_SESSION_STORAGE_KEY);
      }
    }

    const storedRandomness = sessionStorage.getItem(
      RANDOMNESS_SESSION_STORAGE_KEY
    );
    if (storedRandomness) setRandomness(storedRandomness);

    const storedSalt = localStorage.getItem(SALT_LOCAL_STORAGE_KEY);
    if (storedSalt) setSalt(storedSalt);

    const storedNonce = sessionStorage.getItem(NONCE_SESSION_STORAGE_KEY);
    if (storedNonce) setNonce(storedNonce);

    const storedAddress = localStorage.getItem("zkLoginAddress");
    if (storedAddress) setZkLoginUserAddress(storedAddress);

    // Nếu có token từ URL (sau khi redirect từ Google)
    const urlParams = parseUrlHash();
    if (urlParams.id_token) {
      setJwtString(urlParams.id_token);
      localStorage.setItem("jwtString", urlParams.id_token); // ✅ Lưu vào localStorage
      try {
        setDecodedJwt(jwtDecode(urlParams.id_token));
      } catch {
        setError("Invalid JWT token received");
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLoginWithGoogle = async () => {
    setLoading(true);
    setError(undefined);

    try {
      const newEphemeralKeyPair = Ed25519Keypair.generate();
      sessionStorage.setItem(
        KEY_PAIR_SESSION_STORAGE_KEY,
        newEphemeralKeyPair.getSecretKey()
      );
      setEphemeralKeyPair(newEphemeralKeyPair);

      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 2;

      const newRandomness = generateRandomness();
      sessionStorage.setItem(RANDOMNESS_SESSION_STORAGE_KEY, newRandomness);
      setRandomness(newRandomness);

      let currentSalt = salt;
      if (!currentSalt) {
        currentSalt = generateRandomness();
        localStorage.setItem(SALT_LOCAL_STORAGE_KEY, currentSalt);
        setSalt(currentSalt);
      }

      const newNonce = generateNonce(
        newEphemeralKeyPair.getPublicKey(),
        maxEpoch,
        newRandomness
      );
      sessionStorage.setItem(NONCE_SESSION_STORAGE_KEY, newNonce);
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

  // ✅ Xử lý khi đã có jwtString - chỉ setup zkLogin, không thực hiện transaction
  useEffect(() => {
    const setupZkLogin = async () => {
      if (
        !jwtString ||
        !decodedJwt ||
        !ephemeralKeyPair ||
        !randomness ||
        !salt
      )
        return;

      setLoading(true);
      setError(undefined);

      try {
        const address = jwtToAddress(jwtString, salt);
        setZkLoginUserAddress(address);
        localStorage.setItem("zkLoginAddress", address);

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

  const handleReset = () => {
    try {
      sessionStorage.removeItem(KEY_PAIR_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(RANDOMNESS_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(NONCE_SESSION_STORAGE_KEY);

      localStorage.removeItem("jwtString");
      localStorage.removeItem("zkLoginAddress");

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
      <header className="flex items-center gap-4 px-6 py-4 bg-white shadow">
        <h1 className="text-2xl font-bold text-gray-800">
          Sui zkLogin Example
        </h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          {!jwtString ? (
            <button
              className="px-8 py-4 rounded-lg bg-blue-600 text-white font-semibold text-lg shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleLoginWithGoogle}
              disabled={loading}
            >
              {loading ? "Initializing..." : "Login with Google"}
            </button>
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
                  <button
                    className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleExecuteTransaction}
                    disabled={isExecutingTransaction}
                  >
                    {isExecutingTransaction ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Processing Transaction...</span>
                      </div>
                    ) : (
                      `Send ${TRANSFER_AMOUNT} SUI`
                    )}
                  </button>
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

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800 font-medium">Error:</div>
            <div className="text-red-600 mt-1">{error}</div>
          </div>
        )}

        {/* Status Information */}
        <div className="w-full max-w-4xl space-y-4">
          {zkLoginUserAddress && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-2">
                zkLogin Address
              </h3>
              <code className="text-sm bg-gray-100 p-2 rounded block break-all">
                {zkLoginUserAddress}
              </code>
            </div>
          )}

          {executeDigest && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Transaction</h3>
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
            </div>
          )}

          {/* Debug Information */}
          <details className="bg-white rounded-lg shadow">
            <summary className="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-50">
              Debug Information (Click to expand)
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
