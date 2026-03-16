import { describe, it, expect } from 'vitest'
import { getIcon, getGtdIconSvg } from '../../src/utils/icons.js'

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('icons', () => {

    // ─── getIcon ──────────────────────────────────────────────────────────────

    describe('getIcon', () => {
        it('returns an SVG string', () => {
            const result = getIcon('inbox')

            expect(result).toContain('<svg')
            expect(result).toContain('</svg>')
        })

        it('uses default size of 16', () => {
            const result = getIcon('inbox')

            expect(result).toContain('width="16"')
            expect(result).toContain('height="16"')
        })

        it('applies custom size', () => {
            const result = getIcon('inbox', { size: 24 })

            expect(result).toContain('width="24"')
            expect(result).toContain('height="24"')
        })

        it('applies custom className', () => {
            const result = getIcon('inbox', { className: 'my-icon' })

            expect(result).toContain('class="icon my-icon"')
        })

        it('uses empty className by default', () => {
            const result = getIcon('inbox')

            expect(result).toContain('class="icon "')
        })

        it('includes standard SVG attributes', () => {
            const result = getIcon('inbox')

            expect(result).toContain('viewBox="0 0 24 24"')
            expect(result).toContain('fill="none"')
            expect(result).toContain('stroke="currentColor"')
            expect(result).toContain('stroke-width="2"')
        })

        it('returns fallback icon for unknown name', () => {
            const unknown = getIcon('nonexistent-icon')
            const allIcon = getIcon('all')

            expect(unknown).toBe(allIcon)
        })

        it('returns correct icon for inbox', () => {
            const result = getIcon('inbox')

            expect(result).toContain('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>')
        })

        it('returns correct icon for done', () => {
            const result = getIcon('done')

            expect(result).toContain('<circle cx="12" cy="12" r="10"/>')
        })

        it('returns correct icon for trash', () => {
            const result = getIcon('trash')

            expect(result).toContain('<polyline points="3 6 5 6 21 6"/>')
        })

        it('returns correct icon for search', () => {
            const result = getIcon('search')

            expect(result).toContain('<circle cx="11" cy="11" r="8"/>')
        })

        it('supports all GTD status icons', () => {
            const gtdStatuses = ['inbox', 'next_action', 'scheduled', 'waiting_for', 'someday_maybe', 'done']

            for (const status of gtdStatuses) {
                const result = getIcon(status)
                expect(result).toContain('<svg')
            }
        })

        it('supports all action icons', () => {
            const actions = ['plus', 'edit', 'trash', 'x', 'settings', 'menu', 'search', 'check']

            for (const action of actions) {
                const result = getIcon(action)
                expect(result).toContain('<svg')
            }
        })

        it('combines size and className options', () => {
            const result = getIcon('star', { size: 32, className: 'large-icon' })

            expect(result).toContain('width="32"')
            expect(result).toContain('height="32"')
            expect(result).toContain('class="icon large-icon"')
        })
    })

    // ─── getGtdIconSvg ───────────────────────────────────────────────────────

    describe('getGtdIconSvg', () => {
        it('returns SVG string for a GTD status', () => {
            const result = getGtdIconSvg('inbox')

            expect(result).toContain('<svg')
            expect(result).toContain('</svg>')
        })

        it('uses size 16', () => {
            const result = getGtdIconSvg('done')

            expect(result).toContain('width="16"')
            expect(result).toContain('height="16"')
        })

        it('returns same result as getIcon with size 16', () => {
            const statuses = ['inbox', 'next_action', 'scheduled', 'waiting_for', 'someday_maybe', 'done']

            for (const status of statuses) {
                expect(getGtdIconSvg(status)).toBe(getIcon(status, { size: 16 }))
            }
        })

        it('returns fallback for unknown status', () => {
            const result = getGtdIconSvg('unknown')
            const fallback = getIcon('all', { size: 16 })

            expect(result).toBe(fallback)
        })
    })
})
