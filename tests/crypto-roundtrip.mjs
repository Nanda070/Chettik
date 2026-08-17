import assert from 'node:assert/strict'
import sodium from 'libsodium-wrappers-sumo'

await sodium.ready
const alice = sodium.crypto_box_keypair()
const bob = sodium.crypto_box_keypair()
const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
const plaintext = new TextEncoder().encode('Chettik secret message')
const ciphertext = sodium.crypto_box_easy(plaintext, nonce, bob.publicKey, alice.privateKey)
const opened = sodium.crypto_box_open_easy(ciphertext, nonce, alice.publicKey, bob.privateKey)

assert.equal(new TextDecoder().decode(opened), 'Chettik secret message')
console.log('libsodium secret-chat round trip passed')
