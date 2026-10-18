// AES-256-GCM from the platform, never our own: WebCrypto on the web and in the tests;
// on the phone, aes-gcm.native.ts (expo-crypto: CryptoKit on the iPhone, the system
// provider on Android). The bytes are the same everywhere: the ciphertext, then the
// 16-byte tag. A wrong key, nonce, tag or associated data throws.

// WebCrypto's types want ArrayBuffer-backed views; ours always are.
const buf = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;

const subtleKey = (key: Uint8Array, use: 'encrypt' | 'decrypt') => crypto.subtle.importKey('raw', buf(key), 'AES-GCM', false, [use]);
const params = (nonce: Uint8Array, aad?: Uint8Array): AesGcmParams => ({ name: 'AES-GCM', iv: buf(nonce), tagLength: 128, ...(aad ? { additionalData: buf(aad) } : {}) });

export async function gcmEncrypt(key: Uint8Array, nonce: Uint8Array, data: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.encrypt(params(nonce, aad), await subtleKey(key, 'encrypt'), buf(data)));
}

export async function gcmDecrypt(key: Uint8Array, nonce: Uint8Array, sealed: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt(params(nonce, aad), await subtleKey(key, 'decrypt'), buf(sealed)));
}
