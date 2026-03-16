import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Events } from '../../src/core/events.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLoadCollection = vi.fn()
const mockGetById = vi.fn()

vi.mock('../../src/services/data-loader.js', () => ({
    loadCollection: mockLoadCollection,
    getById: mockGetById
}))

const { loadCategories, getCategoryById } = await import('../../src/services/categories.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('categories', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ─── loadCategories ───────────────────────────────────────────────────────

    describe('loadCategories', () => {
        it('calls loadCollection with correct config', async () => {
            mockLoadCollection.mockResolvedValue([])

            await loadCategories()

            expect(mockLoadCollection).toHaveBeenCalledWith({
                table: 'categories',
                storeKey: 'categories',
                event: Events.CATEGORIES_LOADED,
                orderBy: 'created_at',
                decryptFields: ['name']
            })
        })

        it('returns the result from loadCollection', async () => {
            const categories = [
                { id: '1', name: 'Work' },
                { id: '2', name: 'Personal' }
            ]
            mockLoadCollection.mockResolvedValue(categories)

            const result = await loadCategories()

            expect(result).toEqual(categories)
        })

        it('calls loadCollection exactly once', async () => {
            mockLoadCollection.mockResolvedValue([])

            await loadCategories()

            expect(mockLoadCollection).toHaveBeenCalledTimes(1)
        })

        it('propagates errors from loadCollection', async () => {
            mockLoadCollection.mockRejectedValue(new Error('DB error'))

            await expect(loadCategories()).rejects.toThrow('DB error')
        })
    })

    // ─── getCategoryById ──────────────────────────────────────────────────────

    describe('getCategoryById', () => {
        it('calls getById with correct store key and id', () => {
            mockGetById.mockReturnValue({ id: 'cat-1', name: 'Work' })

            getCategoryById('cat-1')

            expect(mockGetById).toHaveBeenCalledWith('categories', 'cat-1')
        })

        it('returns the found category', () => {
            const category = { id: 'cat-1', name: 'Work', color: '#ff0000' }
            mockGetById.mockReturnValue(category)

            const result = getCategoryById('cat-1')

            expect(result).toEqual(category)
        })

        it('returns null when category is not found', () => {
            mockGetById.mockReturnValue(null)

            const result = getCategoryById('nonexistent')

            expect(result).toBeNull()
        })

        it('calls getById exactly once', () => {
            mockGetById.mockReturnValue(null)

            getCategoryById('cat-1')

            expect(mockGetById).toHaveBeenCalledTimes(1)
        })
    })
})
