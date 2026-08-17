import sodium from 'libsodium-wrappers-sumo'

type DeviceIdentity = { publicKey: string; privateKey: string }
type StoredKey = { iv: string; ciphertext: string }
export type SecretHistoryItem = { id: string; sender: string; text: string; createdAt: string; mine: boolean }

const DB_NAME = 'chettik-secret-v1'
const KEY_STORE = 'keys'
const HISTORY_STORE = 'history'
const DEVICE_KEY = 'device-history-key'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE)
      if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function get<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

async function put(storeName: string, key: string, value: unknown) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function deviceKey() {
  const existing = await get<CryptoKey>(KEY_STORE, DEVICE_KEY)
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await put(KEY_STORE, DEVICE_KEY, key)
  return key
}

function bytesToBase64(bytes: Uint8Array) { return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL) }
function base64ToBytes(value: string) { return sodium.from_base64(value, sodium.base64_variants.ORIGINAL) }
function toArrayBuffer(bytes: Uint8Array) { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer }

async function encryptAtRest(value: string): Promise<StoredKey> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, await deviceKey(), new TextEncoder().encode(value))
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)) }
}

async function decryptAtRest(value: StoredKey): Promise<string> {
  const bytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(value.iv)) },
    await deviceKey(),
    toArrayBuffer(base64ToBytes(value.ciphertext)),
  )
  return new TextDecoder().decode(bytes)
}

export async function getDeviceIdentity(accountId: string): Promise<DeviceIdentity> {
  await sodium.ready
  const existing = await get<StoredKey>(KEY_STORE, `identity:${accountId}`)
  if (existing) return JSON.parse(await decryptAtRest(existing)) as DeviceIdentity
  const keypair = sodium.crypto_box_keypair()
  const identity = { publicKey: bytesToBase64(keypair.publicKey), privateKey: bytesToBase64(keypair.privateKey) }
  await put(KEY_STORE, `identity:${accountId}`, await encryptAtRest(JSON.stringify(identity)))
  return identity
}

export async function encryptSecretMessage(privateKey: string, recipientPublicKey: string, plaintext: string) {
  await sodium.ready
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
  const ciphertext = sodium.crypto_box_easy(
    new TextEncoder().encode(plaintext),
    nonce,
    base64ToBytes(recipientPublicKey),
    base64ToBytes(privateKey),
  )
  return { nonce: bytesToBase64(nonce), ciphertext: bytesToBase64(ciphertext) }
}

export async function decryptSecretMessage(privateKey: string, senderPublicKey: string, ciphertext: string, nonce: string) {
  await sodium.ready
  const plaintext = sodium.crypto_box_open_easy(
    base64ToBytes(ciphertext),
    base64ToBytes(nonce),
    base64ToBytes(senderPublicKey),
    base64ToBytes(privateKey),
  )
  return new TextDecoder().decode(plaintext)
}

export async function loadSecretHistory(chatId: string): Promise<SecretHistoryItem[]> {
  const record = await get<StoredKey>(HISTORY_STORE, chatId)
  return record ? JSON.parse(await decryptAtRest(record)) as SecretHistoryItem[] : []
}

export async function saveSecretHistory(chatId: string, messages: SecretHistoryItem[]) {
  await put(HISTORY_STORE, chatId, await encryptAtRest(JSON.stringify(messages)))
}

/** A display-only comparison value for manual device verification, not a ratchet. */
export async function safetyNumber(localPublicKey: string, peerPublicKey: string): Promise<string> {
  await sodium.ready
  const ordered = [localPublicKey, peerPublicKey].sort().join(':')
  const digest = sodium.crypto_generichash(30, new TextEncoder().encode(`chettik-safety-v1:${ordered}`), null)
  return Array.from(digest, byte => String(byte).padStart(3, '0')).join(' ').replace(/(.{47})/g, '$1\n').trim()
}
