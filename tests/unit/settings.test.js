// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'
import { createSupabaseMock } from './helpers/supabase-mock.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = createSupabaseMock()

vi.mock('../../src/core/supabase.js', () => ({
    supabase: mockSupabase
}))

// Mock localStorage (Node 22 / jsdom compatibility)
const localStorageMock = {
    _store: {},
    getItem: vi.fn((key) => localStorageMock._store[key] ?? null),
    setItem: vi.fn((key, value) => { localStorageMock._store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete localStorageMock._store[key] }),
    clear: vi.fn(() => { localStorageMock._store = {} })
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Import modules after mocks
const { upsertUserSetting } = await import('../../src/services/settings-helpers.js')
const { applyTheme, loadThemeFromDatabase, changeTheme, initTheme } = await import('../../src/services/settings-theme.js')
const { loadDensityFromDatabase, changeDensity, initDensity } = await import('../../src/services/settings-density.js')
const { loadUserSettings, saveUserSettings } = await import('../../src/services/settings-user.js')
const { loadNotificationSettings, saveNotificationSettings } = await import('../../src/services/settings-notifications.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('settings', () => {
    beforeEach(() => {
        store.reset()
        mockSupabase._reset()
        vi.clearAllMocks()
        localStorageMock._store = {}
        store.set('currentUser', { id: 'user-1' })
    })

    // ─── settings-helpers ─────────────────────────────────────────────────────

    describe('upsertUserSetting', () => {
        it('updates user_settings and returns success', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1', color_theme: 'dark' }])

            const result = await upsertUserSetting({ color_theme: 'dark' })

            expect(result).toEqual({ success: true })
            expect(mockSupabase.from).toHaveBeenCalledWith('user_settings')
            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ color_theme: 'dark' }))
            expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-1')
        })

        it('falls back to insert when update returns empty data', async () => {
            // update returns empty array
            mockSupabase._queueResult([])
            // insert succeeds
            mockSupabase._queueResult(null)

            const result = await upsertUserSetting({ color_theme: 'dark' })

            expect(result).toEqual({ success: true })
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'user-1',
                color_theme: 'dark'
            }))
        })

        it('falls back to insert when update returns null data', async () => {
            mockSupabase._queueResult(null)
            mockSupabase._queueResult(null)

            const result = await upsertUserSetting({ density_mode: 'compact' })

            expect(result).toEqual({ success: true })
            expect(mockSupabase.insert).toHaveBeenCalled()
        })

        it('falls back to insert when update errors', async () => {
            mockSupabase._queueResult(null, { message: 'update failed' })
            mockSupabase._queueResult(null)

            const result = await upsertUserSetting({ color_theme: 'dark' })

            expect(result).toEqual({ success: true })
        })

        it('returns error when both update and insert fail', async () => {
            mockSupabase._queueResult(null, { message: 'update failed' })
            mockSupabase._queueResult(null, { message: 'insert failed' })

            const result = await upsertUserSetting({ color_theme: 'dark' })

            expect(result).toEqual({ success: false, error: 'Failed to save settings' })
        })

        it('returns error when not logged in', async () => {
            store.set('currentUser', null)

            const result = await upsertUserSetting({ color_theme: 'dark' })

            expect(result).toEqual({ success: false, error: 'Not logged in' })
            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('includes updated_at in the payload', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await upsertUserSetting({ color_theme: 'glass' })

            expect(mockSupabase.update).toHaveBeenCalledWith(
                expect.objectContaining({ updated_at: expect.any(String) })
            )
        })
    })

    // ─── settings-theme ───────────────────────────────────────────────────────

    describe('applyTheme', () => {
        it('sets data-theme attribute on document element', () => {
            applyTheme('dark')

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
        })

        it('can switch themes', () => {
            applyTheme('glass')
            expect(document.documentElement.getAttribute('data-theme')).toBe('glass')

            applyTheme('clear')
            expect(document.documentElement.getAttribute('data-theme')).toBe('clear')
        })
    })

    describe('loadThemeFromDatabase', () => {
        it('loads theme from database and applies it', async () => {
            mockSupabase._queueResult({ color_theme: 'dark' })

            const result = await loadThemeFromDatabase()

            expect(result).toBe('dark')
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
            expect(localStorageMock.setItem).toHaveBeenCalledWith('colorTheme', 'dark')
        })

        it('emits THEME_CHANGED event', async () => {
            const handler = vi.fn()
            events.on(Events.THEME_CHANGED, handler)
            mockSupabase._queueResult({ color_theme: 'clear' })

            await loadThemeFromDatabase()

            expect(handler).toHaveBeenCalledWith('clear')
            events.off(Events.THEME_CHANGED)
        })

        it('returns default theme when no user is logged in', async () => {
            store.set('currentUser', null)

            const result = await loadThemeFromDatabase()

            expect(result).toBe('glass')
        })

        it('returns default theme on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'DB error' })

            const result = await loadThemeFromDatabase()

            expect(result).toBe('glass')
        })

        it('returns default theme when data has no color_theme', async () => {
            mockSupabase._queueResult({ color_theme: null })

            const result = await loadThemeFromDatabase()

            expect(result).toBe('glass')
        })

        it('migrates invalid theme to default and saves to database', async () => {
            // First call: load returns invalid theme
            mockSupabase._queueResult({ color_theme: 'old-invalid-theme' })
            // Second call: upsertUserSetting update
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            const result = await loadThemeFromDatabase()

            expect(result).toBe('glass')
        })
    })

    describe('changeTheme', () => {
        it('applies theme, saves to localStorage, and emits event', async () => {
            // upsertUserSetting: update succeeds
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await changeTheme('dark')

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
            expect(localStorageMock.setItem).toHaveBeenCalledWith('colorTheme', 'dark')
        })

        it('emits THEME_CHANGED event', async () => {
            const handler = vi.fn()
            events.on(Events.THEME_CHANGED, handler)
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await changeTheme('clear')

            expect(handler).toHaveBeenCalledWith('clear')
            events.off(Events.THEME_CHANGED)
        })

        it('does not save to database when no user is logged in', async () => {
            store.set('currentUser', null)

            await changeTheme('dark')

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('saves to database when user is logged in', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await changeTheme('clear')

            expect(mockSupabase.from).toHaveBeenCalledWith('user_settings')
        })
    })

    describe('initTheme', () => {
        it('applies default theme and sets select value', () => {
            const select = document.createElement('select')
            for (const t of ['glass', 'dark', 'clear']) {
                const opt = document.createElement('option')
                opt.value = t
                select.appendChild(opt)
            }

            initTheme(select)

            expect(document.documentElement.getAttribute('data-theme')).toBe('glass')
            expect(select.value).toBe('glass')
        })

        it('applies saved theme from localStorage', () => {
            localStorageMock._store.colorTheme = 'dark'
            const select = document.createElement('select')
            // Add option so value can be set
            const option = document.createElement('option')
            option.value = 'dark'
            select.appendChild(option)

            initTheme(select)

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
            expect(select.value).toBe('dark')
        })

        it('handles null select element', () => {
            expect(() => initTheme(null)).not.toThrow()
            expect(document.documentElement.getAttribute('data-theme')).toBe('glass')
        })

        it('migrates invalid localStorage theme to default', () => {
            localStorageMock._store.colorTheme = 'invalid-theme'
            const select = document.createElement('select')

            initTheme(select)

            expect(document.documentElement.getAttribute('data-theme')).toBe('glass')
            expect(localStorageMock.setItem).toHaveBeenCalledWith('colorTheme', 'glass')
        })
    })

    // ─── settings-density ─────────────────────────────────────────────────────

    describe('loadDensityFromDatabase', () => {
        it('loads density from database and applies it', async () => {
            mockSupabase._queueResult({ density_mode: 'compact' })

            const result = await loadDensityFromDatabase()

            expect(result).toBe('compact')
            expect(document.documentElement.getAttribute('data-density')).toBe('compact')
            expect(localStorageMock.setItem).toHaveBeenCalledWith('densityMode', 'compact')
        })

        it('emits DENSITY_CHANGED event', async () => {
            const handler = vi.fn()
            events.on(Events.DENSITY_CHANGED, handler)
            mockSupabase._queueResult({ density_mode: 'compact' })

            await loadDensityFromDatabase()

            expect(handler).toHaveBeenCalledWith('compact')
            events.off(Events.DENSITY_CHANGED)
        })

        it('returns default density when no user is logged in', async () => {
            store.set('currentUser', null)

            const result = await loadDensityFromDatabase()

            expect(result).toBe('comfortable')
        })

        it('returns default density on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'DB error' })

            const result = await loadDensityFromDatabase()

            expect(result).toBe('comfortable')
        })

        it('returns default density when data has no density_mode', async () => {
            mockSupabase._queueResult({ density_mode: null })

            const result = await loadDensityFromDatabase()

            expect(result).toBe('comfortable')
        })

        it('migrates invalid density to default and saves to database', async () => {
            mockSupabase._queueResult({ density_mode: 'invalid-density' })
            // upsertUserSetting update call
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            const result = await loadDensityFromDatabase()

            expect(result).toBe('comfortable')
        })
    })

    describe('changeDensity', () => {
        it('applies density, saves to localStorage, and emits event', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await changeDensity('compact')

            expect(document.documentElement.getAttribute('data-density')).toBe('compact')
            expect(localStorageMock.setItem).toHaveBeenCalledWith('densityMode', 'compact')
        })

        it('emits DENSITY_CHANGED event', async () => {
            const handler = vi.fn()
            events.on(Events.DENSITY_CHANGED, handler)
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await changeDensity('compact')

            expect(handler).toHaveBeenCalledWith('compact')
            events.off(Events.DENSITY_CHANGED)
        })

        it('does not save to database when no user is logged in', async () => {
            store.set('currentUser', null)

            await changeDensity('compact')

            expect(document.documentElement.getAttribute('data-density')).toBe('compact')
            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('saves to database when user is logged in', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await changeDensity('comfortable')

            expect(mockSupabase.from).toHaveBeenCalledWith('user_settings')
        })
    })

    describe('initDensity', () => {
        it('applies default density and sets select value', () => {
            const select = document.createElement('select')
            for (const d of ['comfortable', 'compact']) {
                const opt = document.createElement('option')
                opt.value = d
                select.appendChild(opt)
            }

            initDensity(select)

            expect(document.documentElement.getAttribute('data-density')).toBe('comfortable')
            expect(select.value).toBe('comfortable')
        })

        it('applies saved density from localStorage', () => {
            localStorageMock._store.densityMode = 'compact'
            const select = document.createElement('select')
            const option = document.createElement('option')
            option.value = 'compact'
            select.appendChild(option)

            initDensity(select)

            expect(document.documentElement.getAttribute('data-density')).toBe('compact')
            expect(select.value).toBe('compact')
        })

        it('handles null select element', () => {
            expect(() => initDensity(null)).not.toThrow()
            expect(document.documentElement.getAttribute('data-density')).toBe('comfortable')
        })

        it('migrates invalid localStorage density to default', () => {
            localStorageMock._store.densityMode = 'invalid-density'
            const select = document.createElement('select')

            initDensity(select)

            expect(document.documentElement.getAttribute('data-density')).toBe('comfortable')
            expect(localStorageMock.setItem).toHaveBeenCalledWith('densityMode', 'comfortable')
        })
    })

    // ─── settings-user ────────────────────────────────────────────────────────

    describe('loadUserSettings', () => {
        it('loads username from database', async () => {
            mockSupabase._queueResult({ username: 'JohnDoe' })

            const result = await loadUserSettings()

            expect(result).toEqual({ username: 'JohnDoe' })
            expect(mockSupabase.from).toHaveBeenCalledWith('user_settings')
            expect(mockSupabase.select).toHaveBeenCalledWith('username')
        })

        it('returns null username when no user is logged in', async () => {
            store.set('currentUser', null)

            const result = await loadUserSettings()

            expect(result).toEqual({ username: null })
        })

        it('returns null username on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'DB error' })

            const result = await loadUserSettings()

            expect(result).toEqual({ username: null })
        })

        it('returns null username when data has no username', async () => {
            mockSupabase._queueResult({ username: null })

            const result = await loadUserSettings()

            expect(result).toEqual({ username: null })
        })

        it('returns null username when data.username is empty string', async () => {
            mockSupabase._queueResult({ username: '' })

            const result = await loadUserSettings()

            expect(result).toEqual({ username: null })
        })
    })

    describe('saveUserSettings', () => {
        it('saves username via upsertUserSetting', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            const result = await saveUserSettings({ username: 'NewName' })

            expect(result).toEqual({ success: true })
            expect(mockSupabase.update).toHaveBeenCalledWith(
                expect.objectContaining({ username: 'NewName' })
            )
        })

        it('saves null when username is empty', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await saveUserSettings({ username: '' })

            expect(mockSupabase.update).toHaveBeenCalledWith(
                expect.objectContaining({ username: null })
            )
        })

        it('saves null when username is not provided', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            await saveUserSettings({})

            expect(mockSupabase.update).toHaveBeenCalledWith(
                expect.objectContaining({ username: null })
            )
        })
    })

    // ─── settings-notifications ───────────────────────────────────────────────

    describe('loadNotificationSettings', () => {
        it('loads notification settings from database', async () => {
            mockSupabase._queueResult({
                email_notifications_enabled: true,
                email_notification_time: '09:00:00',
                timezone: 'Europe/Prague'
            })

            const result = await loadNotificationSettings()

            expect(result).toEqual({
                enabled: true,
                time: '09:00:00',
                timezone: 'Europe/Prague'
            })
        })

        it('returns defaults when no user is logged in', async () => {
            store.set('currentUser', null)

            const result = await loadNotificationSettings()

            expect(result.enabled).toBe(false)
            expect(result.time).toBe('08:00:00')
            expect(typeof result.timezone).toBe('string')
        })

        it('returns defaults on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'DB error' })

            const result = await loadNotificationSettings()

            expect(result.enabled).toBe(false)
            expect(result.time).toBe('08:00:00')
        })

        it('uses default values for missing fields', async () => {
            mockSupabase._queueResult({
                email_notifications_enabled: null,
                email_notification_time: null,
                timezone: null
            })

            const result = await loadNotificationSettings()

            expect(result.enabled).toBe(false)
            expect(result.time).toBe('08:00:00')
            expect(typeof result.timezone).toBe('string')
        })

        it('returns actual values when all fields are present', async () => {
            mockSupabase._queueResult({
                email_notifications_enabled: true,
                email_notification_time: '18:30:00',
                timezone: 'America/New_York'
            })

            const result = await loadNotificationSettings()

            expect(result).toEqual({
                enabled: true,
                time: '18:30:00',
                timezone: 'America/New_York'
            })
        })
    })

    describe('saveNotificationSettings', () => {
        it('saves notification settings via upsertUserSetting', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            const result = await saveNotificationSettings({
                enabled: true,
                time: '09:00:00',
                timezone: 'Europe/Prague'
            })

            expect(result).toEqual({ success: true })
            expect(mockSupabase.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    email_notifications_enabled: true,
                    email_notification_time: '09:00:00',
                    timezone: 'Europe/Prague'
                })
            )
        })

        it('saves disabled notifications', async () => {
            mockSupabase._queueResult([{ user_id: 'user-1' }])

            const result = await saveNotificationSettings({
                enabled: false,
                time: '08:00:00',
                timezone: 'UTC'
            })

            expect(result).toEqual({ success: true })
            expect(mockSupabase.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    email_notifications_enabled: false
                })
            )
        })

        it('returns error when not logged in', async () => {
            store.set('currentUser', null)

            const result = await saveNotificationSettings({
                enabled: true,
                time: '09:00:00',
                timezone: 'UTC'
            })

            expect(result).toEqual({ success: false, error: 'Not logged in' })
        })
    })
})
