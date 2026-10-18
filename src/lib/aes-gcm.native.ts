// AES-256-GCM on the phone: expo-crypto, so the system's own (CryptoKit on the iPhone,
// the system provider on Android). Same bytes as aes-gcm.ts: ciphertext, then the 16-byte tag.
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';

// Copies: a subarray view would hand the native side its whole buffer.
const own = (b: Uint8Array) => b.slice();

export async function gcmEncrypt(key: Uint8Array, nonce: Uint8Array, data: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  const k = await AESEncryptionKey.import(own(key));
  const s = await aesEncryptAsync(own(data), k, { nonce: { bytes: own(nonce) }, tagLength: 16, ...(aad ? { additionalData: own(aad) } : {}) });
  return s.ciphertext({ includeTag: true, encoding: 'bytes' });
}

export async function gcmDecrypt(key: Uint8Array, nonce: Uint8Array, sealed: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  const k = await AESEncryptionKey.import(own(key));
  return aesDecryptAsync(AESSealedData.fromParts(own(nonce), own(sealed), 16), k, { output: 'bytes', ...(aad ? { additionalData: own(aad) } : {}) });
}
