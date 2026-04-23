import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { CryptoUtils } from '../utils/crypto.js'

let _tabKey = null

async function getTabKey() {
    if (!_tabKey) {
        _tabKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
    }
    return _tabKey
}

async function storePasswordSecurely(password) {
    const key = await getTabKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(password)
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)
    sessionStorage.setItem('_ep', btoa(String.fromCharCode(...combined)))
}

async function retrieveStoredPassword() {
    const stored = sessionStorage.getItem('_ep')
    if (!stored || !_tabKey) return null
    try {
        const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
        const iv = combined.slice(0, 12)
        const data = combined.slice(12)
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, _tabKey, data)
        return new TextDecoder().decode(decrypted)
    } catch {
        return null
    }
}

/**
 * Initialize encryption key from password and user
 * @param {Object} user - Supabase user object
 * @param {string} password - User's password
 * @returns {Promise<CryptoKey>} The derived encryption key
 */
export async function initializeEncryption(user, password) {
    // Try to load existing salt from user_settings
    const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('encryption_salt')
        .eq('user_id', user.id)
        .single()

    if (settingsError && settingsError.code !== 'PGRST116') {
        throw new Error('Failed to load encryption settings: ' + settingsError.message)
    }

    let salt
    if (settings && settings.encryption_salt) {
        // Use existing salt
        salt = CryptoUtils.base64ToArray(settings.encryption_salt)
    } else {
        // Generate new salt for new users
        salt = CryptoUtils.generateSalt()
        const saltBase64 = CryptoUtils.arrayToBase64(salt)

        // Save salt to user_settings
        const { error: updateError } = await supabase
            .from('user_settings')
            .upsert({
                user_id: user.id,
                encryption_salt: saltBase64,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })

        if (updateError) {
            throw new Error('Failed to save encryption salt: ' + updateError.message)
        }
    }

    // Derive encryption key from password and salt
    const encryptionKey = await CryptoUtils.deriveKey(password, salt)
    store.set('encryptionKey', encryptionKey)
    return encryptionKey
}

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        return { success: false, error: error.message }
    }

    await initializeEncryption(data.user, password)
    await storePasswordSecurely(password)

    store.set('currentUser', data.user)
    events.emit(Events.AUTH_LOGIN, data.user)

    return { success: true, user: data.user }
}

/**
 * Sign up with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function signup(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

/**
 * Logout current user
 */
export async function logout() {
    await supabase.auth.signOut()
    sessionStorage.removeItem('_ep')
    // Clear persisted UI state
    localStorage.removeItem('selectedAreaId')
    store.reset()
    events.emit(Events.AUTH_LOGOUT)
}

/**
 * Unlock the app with password (for locked sessions)
 * @param {string} password - User password
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function unlock(password) {
    const pendingUser = store.get('pendingUser')
    if (!pendingUser) {
        return { success: false, error: 'No pending user to unlock' }
    }

    // Verify password by attempting to sign in
    const { error } = await supabase.auth.signInWithPassword({
        email: pendingUser.email,
        password: password
    })

    if (error) {
        return { success: false, error: 'Incorrect password' }
    }

    // Initialize encryption with the verified password
    await initializeEncryption(pendingUser, password)

    await storePasswordSecurely(password)

    store.set('currentUser', pendingUser)
    store.set('pendingUser', null)
    events.emit(Events.AUTH_UNLOCK, pendingUser)

    return { success: true, user: pendingUser }
}

/**
 * Lock the app (clear sensitive data but keep session)
 */
export function lock() {
    const currentUser = store.get('currentUser')

    // Store current user for unlock verification
    store.set('pendingUser', currentUser)

    // Clear sensitive data from memory and storage
    store.update({
        encryptionKey: null,
        currentUser: null,
        todos: [],
        categories: [],
        priorities: [],
        contexts: []
    })
    sessionStorage.removeItem('_ep')

    events.emit(Events.AUTH_LOCK)
}

/**
 * Get current session
 * @returns {Promise<{session: Object|null, user: Object|null}>}
 */
export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
        console.error('Failed to retrieve session:', error)
        throw error
    }
    return { session, user: session?.user || null }
}

/**
 * Check if there's a stored password for auto-unlock
 * @returns {string|null} The stored password or null
 */
export async function getStoredPassword() {
    return await retrieveStoredPassword()
}

/**
 * Set up auth state change listener
 * @param {Function} onSignOut - Callback for sign out events
 */
export function onAuthStateChange(onSignOut) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            onSignOut()
        }
    })
}

/**
 * Encrypt text using the current encryption key
 * @param {string} plaintext - Text to encrypt
 * @returns {Promise<string>} Encrypted text
 */
export async function encrypt(plaintext) {
    const encryptionKey = store.get('encryptionKey')
    if (!encryptionKey) {
        throw new Error('Encryption key not available. Please log out and log in again.')
    }
    return await CryptoUtils.encrypt(plaintext, encryptionKey)
}

/**
 * Decrypt text using the current encryption key
 * @param {string} ciphertext - Text to decrypt
 * @returns {Promise<string>} Decrypted text
 */
export async function decrypt(ciphertext) {
    const encryptionKey = store.get('encryptionKey')
    if (!encryptionKey) return ciphertext
    if (!ciphertext || ciphertext.length < 20) return ciphertext
    try {
        return await CryptoUtils.decrypt(ciphertext, encryptionKey)
    } catch (e) {
        const looksEncrypted = /^[A-Za-z0-9+/]+=*$/.test(ciphertext) && ciphertext.length >= 32
        if (looksEncrypted) {
            console.error('Decryption failed for data that appears encrypted:', e)
            throw new Error('Failed to decrypt data. Your encryption key may be incorrect.')
        }
        return ciphertext
    }
}
