// Encryption utilities using Web Crypto API
export const CryptoUtils = {
    // Derive an encryption key from password and salt using PBKDF2
    async deriveKey(password, salt) {
        const encoder = new TextEncoder()
        const passwordBuffer = encoder.encode(password)

        // Import password as a key
        const baseKey = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveKey']
        )

        // Derive AES-GCM key using PBKDF2
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
    },

    // Generate a random salt for key derivation
    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(16))
    },

    // Convert Uint8Array to base64 string
    arrayToBase64(array) {
        return btoa(String.fromCharCode(...array))
    },

    // Convert base64 string to Uint8Array
    base64ToArray(base64) {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return bytes
    },

    // Encrypt plaintext using AES-GCM
    async encrypt(plaintext, key) {
        const encoder = new TextEncoder()
        const data = encoder.encode(plaintext)

        // Generate random IV for each encryption
        const iv = crypto.getRandomValues(new Uint8Array(12))

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        )

        // Combine IV + ciphertext and encode as base64
        const combined = new Uint8Array(iv.length + ciphertext.byteLength)
        combined.set(iv)
        combined.set(new Uint8Array(ciphertext), iv.length)

        return this.arrayToBase64(combined)
    },

    // Decrypt ciphertext using AES-GCM
    async decrypt(encryptedBase64, key) {
        const combined = this.base64ToArray(encryptedBase64)

        // Extract IV (first 12 bytes) and ciphertext
        const iv = combined.slice(0, 12)
        const ciphertext = combined.slice(12)

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        )

        const decoder = new TextDecoder()
        return decoder.decode(decrypted)
    }
}

// Check if a string looks like encrypted data (base64 with IV prefix)
export function isEncrypted(text) {
    if (!text || text.length < 24) return false
    // Encrypted data is base64 with at least 12 bytes IV + some ciphertext
    // Base64 of 24+ bytes = 32+ characters
    const base64Regex = /^[A-Za-z0-9+/]+=*$/
    return base64Regex.test(text) && text.length >= 32
}
