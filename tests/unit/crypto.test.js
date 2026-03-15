import { describe, it, expect } from 'vitest'
import { CryptoUtils, isEncrypted } from '../../src/utils/crypto.js'

// ─── Helper ─────────────────────────────────────────────────────────────────────

async function makeKey(password = 'test-password') {
    const salt = CryptoUtils.generateSalt()
    return { key: await CryptoUtils.deriveKey(password, salt), salt }
}

// ─── arrayToBase64 / base64ToArray ──────────────────────────────────────────────

describe('arrayToBase64', () => {
    it('converts known bytes to expected base64', () => {
        // "Hello" in ASCII
        const bytes = new Uint8Array([72, 101, 108, 108, 111])
        expect(CryptoUtils.arrayToBase64(bytes)).toBe('SGVsbG8=')
    })

    it('converts empty array to empty string', () => {
        expect(CryptoUtils.arrayToBase64(new Uint8Array([]))).toBe('')
    })

    it('handles binary data with values above 127', () => {
        const bytes = new Uint8Array([200, 255, 128, 0, 1])
        const base64 = CryptoUtils.arrayToBase64(bytes)
        expect(base64).toBeTruthy()
        // Round-trip check
        const decoded = CryptoUtils.base64ToArray(base64)
        expect(decoded).toEqual(bytes)
    })
})

describe('base64ToArray', () => {
    it('converts known base64 to expected bytes', () => {
        const result = CryptoUtils.base64ToArray('SGVsbG8=')
        expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]))
    })

    it('converts empty string to empty Uint8Array', () => {
        const result = CryptoUtils.base64ToArray('')
        expect(result).toEqual(new Uint8Array([]))
    })

    it('round-trips with arrayToBase64', () => {
        const original = 'SGVsbG8='
        const roundTripped = CryptoUtils.arrayToBase64(CryptoUtils.base64ToArray(original))
        expect(roundTripped).toBe(original)
    })
})

// ─── generateSalt ───────────────────────────────────────────────────────────────

describe('generateSalt', () => {
    it('returns a Uint8Array of length 16', () => {
        const salt = CryptoUtils.generateSalt()
        expect(salt).toBeInstanceOf(Uint8Array)
        expect(salt.length).toBe(16)
    })

    it('produces different values on successive calls', () => {
        const salt1 = CryptoUtils.generateSalt()
        const salt2 = CryptoUtils.generateSalt()
        const b1 = CryptoUtils.arrayToBase64(salt1)
        const b2 = CryptoUtils.arrayToBase64(salt2)
        expect(b1).not.toBe(b2)
    })

    it('contains only values in 0-255 range', () => {
        const salt = CryptoUtils.generateSalt()
        for (const byte of salt) {
            expect(byte).toBeGreaterThanOrEqual(0)
            expect(byte).toBeLessThanOrEqual(255)
        }
    })
})

// ─── deriveKey ──────────────────────────────────────────────────────────────────

describe('deriveKey', () => {
    it('returns a CryptoKey object', async () => {
        const { key } = await makeKey()
        expect(key).toBeDefined()
        expect(key.constructor.name).toBe('CryptoKey')
    })

    it('key has AES-GCM algorithm', async () => {
        const { key } = await makeKey()
        expect(key.algorithm.name).toBe('AES-GCM')
    })

    it('key has 256-bit length', async () => {
        const { key } = await makeKey()
        expect(key.algorithm.length).toBe(256)
    })

    it('key has encrypt and decrypt usages', async () => {
        const { key } = await makeKey()
        expect(key.usages).toContain('encrypt')
        expect(key.usages).toContain('decrypt')
    })

    it('same password and salt produce same key (deterministic)', async () => {
        const salt = CryptoUtils.generateSalt()
        const key1 = await CryptoUtils.deriveKey('my-password', salt)
        const key2 = await CryptoUtils.deriveKey('my-password', salt)

        // Encrypt with key1, decrypt with key2 to prove they are identical
        const encrypted = await CryptoUtils.encrypt('test-data', key1)
        const decrypted = await CryptoUtils.decrypt(encrypted, key2)
        expect(decrypted).toBe('test-data')
    })

    it('different passwords produce different keys', async () => {
        const salt = CryptoUtils.generateSalt()
        const key1 = await CryptoUtils.deriveKey('password-one', salt)
        const key2 = await CryptoUtils.deriveKey('password-two', salt)

        const encrypted = await CryptoUtils.encrypt('test-data', key1)
        await expect(CryptoUtils.decrypt(encrypted, key2)).rejects.toThrow()
    })
})

// ─── encrypt / decrypt (round-trip) ─────────────────────────────────────────────

describe('encrypt / decrypt', () => {
    it('round-trips plain text', async () => {
        const { key } = await makeKey()
        const plaintext = 'Hello, World!'
        const encrypted = await CryptoUtils.encrypt(plaintext, key)
        const decrypted = await CryptoUtils.decrypt(encrypted, key)
        expect(decrypted).toBe(plaintext)
    })

    it('works with short text', async () => {
        const { key } = await makeKey()
        const decrypted = await CryptoUtils.decrypt(
            await CryptoUtils.encrypt('hi', key),
            key
        )
        expect(decrypted).toBe('hi')
    })

    it('works with long text (1000+ characters)', async () => {
        const { key } = await makeKey()
        const longText = 'A'.repeat(1500)
        const decrypted = await CryptoUtils.decrypt(
            await CryptoUtils.encrypt(longText, key),
            key
        )
        expect(decrypted).toBe(longText)
    })

    it('works with Unicode emoji', async () => {
        const { key } = await makeKey()
        const text = 'Hello 🌍🎉🚀 World'
        const decrypted = await CryptoUtils.decrypt(
            await CryptoUtils.encrypt(text, key),
            key
        )
        expect(decrypted).toBe(text)
    })

    it('works with CJK characters', async () => {
        const { key } = await makeKey()
        const text = '你好世界 こんにちは 안녕하세요'
        const decrypted = await CryptoUtils.decrypt(
            await CryptoUtils.encrypt(text, key),
            key
        )
        expect(decrypted).toBe(text)
    })

    it('works with empty string', async () => {
        const { key } = await makeKey()
        const decrypted = await CryptoUtils.decrypt(
            await CryptoUtils.encrypt('', key),
            key
        )
        expect(decrypted).toBe('')
    })

    it('encrypted output is valid base64', async () => {
        const { key } = await makeKey()
        const encrypted = await CryptoUtils.encrypt('test', key)
        const base64Regex = /^[A-Za-z0-9+/]+=*$/
        expect(base64Regex.test(encrypted)).toBe(true)
    })

    it('encrypted output differs from plaintext', async () => {
        const { key } = await makeKey()
        const plaintext = 'this is secret data'
        const encrypted = await CryptoUtils.encrypt(plaintext, key)
        expect(encrypted).not.toBe(plaintext)
    })

    it('two encryptions of same text produce different ciphertext (random IV)', async () => {
        const { key } = await makeKey()
        const plaintext = 'same input twice'
        const encrypted1 = await CryptoUtils.encrypt(plaintext, key)
        const encrypted2 = await CryptoUtils.encrypt(plaintext, key)
        expect(encrypted1).not.toBe(encrypted2)
    })

    it('encrypted output contains at least 12 bytes IV plus data', async () => {
        const { key } = await makeKey()
        const encrypted = await CryptoUtils.encrypt('x', key)
        const decoded = CryptoUtils.base64ToArray(encrypted)
        // 12 bytes IV + at least 1 byte ciphertext + 16 bytes GCM tag
        expect(decoded.length).toBeGreaterThanOrEqual(12 + 1)
    })
})

// ─── decrypt error handling ─────────────────────────────────────────────────────

describe('decrypt error handling', () => {
    it('rejects on corrupted ciphertext', async () => {
        const { key } = await makeKey()
        const encrypted = await CryptoUtils.encrypt('test', key)
        // Corrupt the ciphertext by modifying bytes
        const bytes = CryptoUtils.base64ToArray(encrypted)
        bytes[bytes.length - 1] ^= 0xff
        const corrupted = CryptoUtils.arrayToBase64(bytes)
        await expect(CryptoUtils.decrypt(corrupted, key)).rejects.toThrow()
    })

    it('rejects on wrong key', async () => {
        const { key: key1 } = await makeKey('password-a')
        const { key: key2 } = await makeKey('password-b')
        const encrypted = await CryptoUtils.encrypt('secret', key1)
        await expect(CryptoUtils.decrypt(encrypted, key2)).rejects.toThrow()
    })

    it('rejects on truncated data', async () => {
        const { key } = await makeKey()
        const encrypted = await CryptoUtils.encrypt('test data here', key)
        const bytes = CryptoUtils.base64ToArray(encrypted)
        // Truncate to only IV (12 bytes), removing all ciphertext
        const truncated = CryptoUtils.arrayToBase64(bytes.slice(0, 12))
        await expect(CryptoUtils.decrypt(truncated, key)).rejects.toThrow()
    })
})

// ─── isEncrypted ────────────────────────────────────────────────────────────────

describe('isEncrypted', () => {
    it('returns false for null', () => {
        expect(isEncrypted(null)).toBe(false)
    })

    it('returns false for undefined', () => {
        expect(isEncrypted(undefined)).toBe(false)
    })

    it('returns false for empty string', () => {
        expect(isEncrypted('')).toBe(false)
    })

    it('returns false for short strings (< 32 chars)', () => {
        expect(isEncrypted('abc123')).toBe(false)
        expect(isEncrypted('ShortBase64Value')).toBe(false)
    })

    it('returns false for non-base64 strings with spaces', () => {
        expect(isEncrypted('this is a long string with spaces that is over 32 characters')).toBe(false)
    })

    it('returns false for non-base64 strings with special chars', () => {
        expect(isEncrypted('hello!world@test#value$more%data^here&plus')).toBe(false)
    })

    it('returns false for base64 strings shorter than 32 chars', () => {
        // 20 chars of valid base64
        expect(isEncrypted('ABCDEFGHIJKLMNOPQRST')).toBe(false)
    })

    it('returns true for valid base64 strings >= 32 chars', () => {
        // 32 chars of valid base64
        const longBase64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'
        expect(longBase64.length).toBe(32)
        expect(isEncrypted(longBase64)).toBe(true)
    })

    it('returns true for base64 with padding >= 32 chars', () => {
        const padded = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef=='
        expect(padded.length).toBeGreaterThanOrEqual(32)
        expect(isEncrypted(padded)).toBe(true)
    })

    it('returns true for actual encrypted output', async () => {
        const { key } = await makeKey()
        const encrypted = await CryptoUtils.encrypt('some secret text', key)
        expect(isEncrypted(encrypted)).toBe(true)
    })
})
