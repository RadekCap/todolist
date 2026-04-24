// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'

// ─── Storage polyfill (Node 22's global localStorage lacks Storage methods) ──

const mockLocalStorage = { removeItem: vi.fn(), setItem: vi.fn(), getItem: vi.fn() }
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true, configurable: true })

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/utils/crypto.js', () => ({
    CryptoUtils: {
        deriveKey: vi.fn(() => Promise.resolve('mock-derived-key')),
        generateSalt: vi.fn(() => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])),
        arrayToBase64: vi.fn(() => 'base64-salt'),
        base64ToArray: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
        encrypt: vi.fn((text) => Promise.resolve(`encrypted:${text}`)),
        decrypt: vi.fn((text) => Promise.resolve(text?.startsWith?.('encrypted:') ? text.slice(10) : text))
    }
}))

const mockAuth = {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn()
}

function createSupabaseMock() {
    const results = []
    let callIndex = 0
    const chain = {
        from: vi.fn(() => chain),
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        upsert: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        single: vi.fn(() => chain),
        then: vi.fn((resolve) => {
            const result = results[callIndex] || { data: null, error: null }
            callIndex++
            resolve(result)
        }),
        _queueResult(data, error = null) {
            results.push({ data, error })
        },
        _reset() {
            results.length = 0
            callIndex = 0
        }
    }
    return chain
}

const mockChain = createSupabaseMock()
const mockSupabase = { ...mockChain, auth: mockAuth }

vi.mock('../../src/core/supabase.js', () => ({
    supabase: mockSupabase
}))

// Import after mocks
const {
    initializeEncryption, login, signup, logout, unlock, lock,
    getSession, getStoredPassword, onAuthStateChange, encrypt, decrypt
} = await import('../../src/services/auth.js')

const { CryptoUtils } = await import('../../src/utils/crypto.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('auth', () => {
    const testUser = { id: 'user-1', email: 'test@example.com' }

    beforeEach(() => {
        store.reset()
        mockChain._reset()
        vi.clearAllMocks()
        sessionStorage.removeItem('_ep')
        mockLocalStorage.removeItem.mockClear()
        mockLocalStorage.setItem.mockClear()
        mockLocalStorage.getItem.mockClear()
    })

    // ─── initializeEncryption ─────────────────────────────────────────────

    describe('initializeEncryption', () => {
        it('uses existing salt from user_settings', async () => {
            mockChain._queueResult({ encryption_salt: 'existing-salt-b64' })

            await initializeEncryption(testUser, 'password123')

            expect(CryptoUtils.base64ToArray).toHaveBeenCalledWith('existing-salt-b64')
            expect(CryptoUtils.generateSalt).not.toHaveBeenCalled()
        })

        it('generates new salt when no existing salt', async () => {
            mockChain._queueResult(null) // no settings
            mockChain._queueResult(null) // upsert result

            await initializeEncryption(testUser, 'password123')

            expect(CryptoUtils.generateSalt).toHaveBeenCalled()
            expect(mockChain.upsert).toHaveBeenCalled()
        })

        it('generates new salt when encryption_salt is null', async () => {
            mockChain._queueResult({ encryption_salt: null })
            mockChain._queueResult(null) // upsert result

            await initializeEncryption(testUser, 'password123')

            expect(CryptoUtils.generateSalt).toHaveBeenCalled()
        })

        it('calls deriveKey with password and salt', async () => {
            mockChain._queueResult({ encryption_salt: 'salt-b64' })

            await initializeEncryption(testUser, 'mypassword')

            expect(CryptoUtils.deriveKey).toHaveBeenCalledWith(
                'mypassword',
                expect.any(Uint8Array)
            )
        })

        it('sets encryptionKey in store', async () => {
            mockChain._queueResult({ encryption_salt: 'salt-b64' })

            await initializeEncryption(testUser, 'password123')

            expect(store.get('encryptionKey')).toBe('mock-derived-key')
        })

        it('returns the derived key', async () => {
            mockChain._queueResult({ encryption_salt: 'salt-b64' })

            const result = await initializeEncryption(testUser, 'password123')

            expect(result).toBe('mock-derived-key')
        })

        it('throws on upsert error', async () => {
            mockChain._queueResult(null) // no settings
            mockChain._queueResult(null, { message: 'upsert failed' }) // upsert error

            await expect(initializeEncryption(testUser, 'password123'))
                .rejects.toThrow('Failed to save encryption salt: upsert failed')
        })
    })

    // ─── login ────────────────────────────────────────────────────────────

    describe('login', () => {
        it('calls signInWithPassword with email and password', async () => {
            mockAuth.signInWithPassword.mockResolvedValue({
                data: { user: testUser }, error: null
            })
            mockChain._queueResult({ encryption_salt: 'salt' })

            await login('test@example.com', 'pass123')

            expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'pass123'
            })
        })

        it('returns { success: true, user } on success', async () => {
            mockAuth.signInWithPassword.mockResolvedValue({
                data: { user: testUser }, error: null
            })
            mockChain._queueResult({ encryption_salt: 'salt' })

            const result = await login('test@example.com', 'pass123')

            expect(result).toEqual({ success: true, user: testUser })
        })

        it('returns { success: false, error } on auth error', async () => {
            mockAuth.signInWithPassword.mockResolvedValue({
                data: null, error: { message: 'Invalid credentials' }
            })

            const result = await login('test@example.com', 'wrong')

            expect(result).toEqual({ success: false, error: 'Invalid credentials' })
        })

        it('stores password securely in sessionStorage', async () => {
            mockAuth.signInWithPassword.mockResolvedValue({
                data: { user: testUser }, error: null
            })
            mockChain._queueResult({ encryption_salt: 'salt' })

            await login('test@example.com', 'pass123')

            const stored = sessionStorage.getItem('_ep')
            expect(stored).toBeTruthy()
            expect(stored).not.toBe('pass123')
            expect(await getStoredPassword()).toBe('pass123')
        })

        it('sets currentUser in store', async () => {
            mockAuth.signInWithPassword.mockResolvedValue({
                data: { user: testUser }, error: null
            })
            mockChain._queueResult({ encryption_salt: 'salt' })

            await login('test@example.com', 'pass123')

            expect(store.get('currentUser')).toEqual(testUser)
        })

        it('emits AUTH_LOGIN event', async () => {
            mockAuth.signInWithPassword.mockResolvedValue({
                data: { user: testUser }, error: null
            })
            mockChain._queueResult({ encryption_salt: 'salt' })
            const handler = vi.fn()
            events.on(Events.AUTH_LOGIN, handler)

            await login('test@example.com', 'pass123')

            expect(handler).toHaveBeenCalledWith(testUser)
            events.off(Events.AUTH_LOGIN)
        })
    })

    // ─── signup ───────────────────────────────────────────────────────────

    describe('signup', () => {
        it('calls signUp with email and password', async () => {
            mockAuth.signUp.mockResolvedValue({ data: {}, error: null })

            await signup('new@example.com', 'pass123')

            expect(mockAuth.signUp).toHaveBeenCalledWith({
                email: 'new@example.com',
                password: 'pass123'
            })
        })

        it('returns { success: true } on success', async () => {
            mockAuth.signUp.mockResolvedValue({ data: {}, error: null })

            const result = await signup('new@example.com', 'pass123')

            expect(result).toEqual({ success: true })
        })

        it('returns { success: false, error } on error', async () => {
            mockAuth.signUp.mockResolvedValue({
                data: null, error: { message: 'Email taken' }
            })

            const result = await signup('taken@example.com', 'pass123')

            expect(result).toEqual({ success: false, error: 'Email taken' })
        })
    })

    // ─── logout ───────────────────────────────────────────────────────────

    describe('logout', () => {
        it('calls supabase.auth.signOut', async () => {
            await logout()

            expect(mockAuth.signOut).toHaveBeenCalled()
        })

        it('removes _ep from sessionStorage', async () => {
            sessionStorage.setItem('_ep', 'stored-pass')

            await logout()

            expect(sessionStorage.getItem('_ep')).toBeNull()
        })

        it('removes selectedAreaId from localStorage', async () => {
            await logout()

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('selectedAreaId')
        })

        it('resets store', async () => {
            store.set('currentUser', testUser)
            store.set('todos', [{ id: 'todo-1' }])

            await logout()

            expect(store.get('currentUser')).toBeFalsy()
        })

        it('emits AUTH_LOGOUT event', async () => {
            const handler = vi.fn()
            events.on(Events.AUTH_LOGOUT, handler)

            await logout()

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.AUTH_LOGOUT)
        })
    })

    // ─── unlock ───────────────────────────────────────────────────────────

    describe('unlock', () => {
        it('returns error when no pendingUser in store', async () => {
            const result = await unlock('password')

            expect(result).toEqual({ success: false, error: 'No pending user to unlock' })
        })

        it('verifies password via signInWithPassword', async () => {
            store.set('pendingUser', testUser)
            mockAuth.signInWithPassword.mockResolvedValue({ error: null })
            mockChain._queueResult({ encryption_salt: 'salt' })

            await unlock('pass123')

            expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
                email: testUser.email,
                password: 'pass123'
            })
        })

        it('returns error on incorrect password', async () => {
            store.set('pendingUser', testUser)
            mockAuth.signInWithPassword.mockResolvedValue({
                error: { message: 'Wrong password' }
            })

            const result = await unlock('wrong')

            expect(result).toEqual({ success: false, error: 'Incorrect password' })
        })

        it('initializes encryption on success', async () => {
            store.set('pendingUser', testUser)
            mockAuth.signInWithPassword.mockResolvedValue({ error: null })
            mockChain._queueResult({ encryption_salt: 'salt' })

            await unlock('pass123')

            expect(store.get('encryptionKey')).toBe('mock-derived-key')
        })

        it('stores password securely in sessionStorage', async () => {
            store.set('pendingUser', testUser)
            mockAuth.signInWithPassword.mockResolvedValue({ error: null })
            mockChain._queueResult({ encryption_salt: 'salt' })

            await unlock('pass123')

            const stored = sessionStorage.getItem('_ep')
            expect(stored).toBeTruthy()
            expect(stored).not.toBe('pass123')
            expect(await getStoredPassword()).toBe('pass123')
        })

        it('sets currentUser and clears pendingUser', async () => {
            store.set('pendingUser', testUser)
            mockAuth.signInWithPassword.mockResolvedValue({ error: null })
            mockChain._queueResult({ encryption_salt: 'salt' })

            await unlock('pass123')

            expect(store.get('currentUser')).toEqual(testUser)
            expect(store.get('pendingUser')).toBeNull()
        })

        it('emits AUTH_UNLOCK event', async () => {
            store.set('pendingUser', testUser)
            mockAuth.signInWithPassword.mockResolvedValue({ error: null })
            mockChain._queueResult({ encryption_salt: 'salt' })
            const handler = vi.fn()
            events.on(Events.AUTH_UNLOCK, handler)

            await unlock('pass123')

            expect(handler).toHaveBeenCalledWith(testUser)
            events.off(Events.AUTH_UNLOCK)
        })

        it('returns { success: true, user }', async () => {
            store.set('pendingUser', testUser)
            mockAuth.signInWithPassword.mockResolvedValue({ error: null })
            mockChain._queueResult({ encryption_salt: 'salt' })

            const result = await unlock('pass123')

            expect(result).toEqual({ success: true, user: testUser })
        })
    })

    // ─── lock ─────────────────────────────────────────────────────────────

    describe('lock', () => {
        beforeEach(() => {
            store.set('currentUser', testUser)
            store.set('encryptionKey', 'some-key')
            store.set('todos', [{ id: 'todo-1' }])
            store.set('categories', [{ id: 'cat-1' }])
            store.set('priorities', [{ id: 'pri-1' }])
            store.set('contexts', [{ id: 'ctx-1' }])
            sessionStorage.setItem('_ep', 'stored-pass')
        })

        it('stores currentUser as pendingUser', () => {
            lock()

            expect(store.get('pendingUser')).toEqual(testUser)
        })

        it('clears encryptionKey', () => {
            lock()

            expect(store.get('encryptionKey')).toBeNull()
        })

        it('clears currentUser', () => {
            lock()

            expect(store.get('currentUser')).toBeNull()
        })

        it('clears todos, categories, priorities, contexts', () => {
            lock()

            expect(store.get('todos')).toEqual([])
            expect(store.get('categories')).toEqual([])
            expect(store.get('priorities')).toEqual([])
            expect(store.get('contexts')).toEqual([])
        })

        it('removes _ep from sessionStorage', () => {
            lock()

            expect(sessionStorage.getItem('_ep')).toBeNull()
        })

        it('emits AUTH_LOCK event', () => {
            const handler = vi.fn()
            events.on(Events.AUTH_LOCK, handler)

            lock()

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.AUTH_LOCK)
        })
    })

    // ─── getSession ───────────────────────────────────────────────────────

    describe('getSession', () => {
        it('returns session and user from supabase', async () => {
            const mockSession = { user: testUser, access_token: 'token' }
            mockAuth.getSession.mockResolvedValue({
                data: { session: mockSession }
            })

            const result = await getSession()

            expect(result).toEqual({ session: mockSession, user: testUser })
        })

        it('returns null user when no session', async () => {
            mockAuth.getSession.mockResolvedValue({
                data: { session: null }
            })

            const result = await getSession()

            expect(result).toEqual({ session: null, user: null })
        })
    })

    // ─── getStoredPassword ────────────────────────────────────────────────

    describe('getStoredPassword', () => {
        it('returns password after secure storage round-trip', async () => {
            mockAuth.signInWithPassword.mockResolvedValue({
                data: { user: testUser }, error: null
            })
            mockChain._queueResult({ encryption_salt: 'salt' })

            await login('test@example.com', 'round-trip-pass')

            expect(await getStoredPassword()).toBe('round-trip-pass')
        })

        it('returns null when no stored password', async () => {
            expect(await getStoredPassword()).toBeNull()
        })
    })

    // ─── onAuthStateChange ────────────────────────────────────────────────

    describe('onAuthStateChange', () => {
        it('registers listener with supabase.auth', () => {
            const callback = vi.fn()

            onAuthStateChange(callback)

            expect(mockAuth.onAuthStateChange).toHaveBeenCalledWith(expect.any(Function))
        })

        it('calls onSignOut callback on SIGNED_OUT event', () => {
            const onSignOut = vi.fn()
            onAuthStateChange(onSignOut)

            // Get the callback that was registered
            const registeredCallback = mockAuth.onAuthStateChange.mock.calls[0][0]
            registeredCallback('SIGNED_OUT', null)

            expect(onSignOut).toHaveBeenCalled()
        })

        it('does NOT call onSignOut for other events', () => {
            const onSignOut = vi.fn()
            onAuthStateChange(onSignOut)

            const registeredCallback = mockAuth.onAuthStateChange.mock.calls[0][0]
            registeredCallback('SIGNED_IN', { user: testUser })

            expect(onSignOut).not.toHaveBeenCalled()
        })
    })

    // ─── encrypt ──────────────────────────────────────────────────────────

    describe('encrypt', () => {
        it('returns encrypted text when encryptionKey exists', async () => {
            store.set('encryptionKey', 'mock-key')

            const result = await encrypt('hello')

            expect(result).toBe('encrypted:hello')
            expect(CryptoUtils.encrypt).toHaveBeenCalledWith('hello', 'mock-key')
        })

        it('throws when no encryptionKey is available', async () => {
            // No encryptionKey set

            await expect(encrypt('hello')).rejects.toThrow(
                'Encryption key not available. Please log out and log in again.'
            )
            expect(CryptoUtils.encrypt).not.toHaveBeenCalled()
        })
    })

    // ─── decrypt ──────────────────────────────────────────────────────────

    describe('decrypt', () => {
        it('returns decrypted text when encryptionKey exists', async () => {
            store.set('encryptionKey', 'mock-key')

            const result = await decrypt('longEnoughCiphertextForDecryption')

            expect(CryptoUtils.decrypt).toHaveBeenCalledWith('longEnoughCiphertextForDecryption', 'mock-key')
        })

        it('returns ciphertext when no encryptionKey (passthrough)', async () => {
            const result = await decrypt('some-encrypted-data-here')

            expect(result).toBe('some-encrypted-data-here')
            expect(CryptoUtils.decrypt).not.toHaveBeenCalled()
        })

        it('returns ciphertext for null input', async () => {
            store.set('encryptionKey', 'mock-key')

            const result = await decrypt(null)

            expect(result).toBeNull()
        })

        it('returns ciphertext for short strings (< 20 chars)', async () => {
            store.set('encryptionKey', 'mock-key')

            const result = await decrypt('short')

            expect(result).toBe('short')
            expect(CryptoUtils.decrypt).not.toHaveBeenCalled()
        })

        it('returns original text when decryption throws for non-encrypted-looking data (legacy data)', async () => {
            store.set('encryptionKey', 'mock-key')
            CryptoUtils.decrypt.mockRejectedValueOnce(new Error('bad data'))

            const result = await decrypt('this-is-long-enough-to-try-decrypt')

            expect(result).toBe('this-is-long-enough-to-try-decrypt')
        })

        it('throws error when decryption fails for encrypted-looking data', async () => {
            store.set('encryptionKey', 'mock-key')
            CryptoUtils.decrypt.mockRejectedValueOnce(new Error('bad data'))
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            // Base64-looking string with length >= 32
            const encryptedLooking = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

            await expect(decrypt(encryptedLooking)).rejects.toThrow('Failed to decrypt data. Your encryption key may be incorrect.')
            expect(errorSpy).toHaveBeenCalled()
            errorSpy.mockRestore()
        })
    })
})
