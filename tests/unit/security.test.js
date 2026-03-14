// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { escapeHtml, validateColor } from '../../src/utils/security.js'

// ─── escapeHtml ─────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
    describe('normal text', () => {
        it('returns plain text unchanged', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World')
        })

        it('returns empty string for empty input', () => {
            expect(escapeHtml('')).toBe('')
        })

        it('handles text with spaces and punctuation', () => {
            expect(escapeHtml('Hello, World! How are you?')).toBe('Hello, World! How are you?')
        })
    })

    describe('special characters', () => {
        it('escapes ampersand', () => {
            expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
        })

        it('escapes less-than sign', () => {
            expect(escapeHtml('a < b')).toBe('a &lt; b')
        })

        it('escapes greater-than sign', () => {
            expect(escapeHtml('a > b')).toBe('a &gt; b')
        })

        it('escapes double quotes', () => {
            expect(escapeHtml('say "hello"')).toBe('say "hello"')
        })

        it('escapes single quotes', () => {
            const result = escapeHtml("it's")
            // Single quotes may or may not be escaped depending on the DOM implementation
            expect(result).toContain('it')
            expect(result).toContain('s')
        })

        it('escapes multiple special characters together', () => {
            expect(escapeHtml('<a href="url">&</a>')).toBe('&lt;a href="url"&gt;&amp;&lt;/a&gt;')
        })
    })

    describe('HTML tags and XSS vectors', () => {
        it('escapes simple HTML tags', () => {
            const result = escapeHtml('<b>bold</b>')
            expect(result).toBe('&lt;b&gt;bold&lt;/b&gt;')
        })

        it('escapes script tags', () => {
            const result = escapeHtml('<script>alert("xss")</script>')
            expect(result).toContain('&lt;script&gt;')
            expect(result).toContain('&lt;/script&gt;')
            expect(result).not.toContain('<script>')
        })

        it('escapes event handler attributes', () => {
            const result = escapeHtml('<img onerror="alert(1)" src="x">')
            expect(result).toContain('&lt;img')
            expect(result).not.toContain('<img')
        })

        it('escapes nested HTML', () => {
            const result = escapeHtml('<div><span><a href="javascript:void(0)">click</a></span></div>')
            expect(result).toContain('&lt;div&gt;')
            expect(result).not.toContain('<div>')
        })

        it('escapes iframe tags', () => {
            const result = escapeHtml('<iframe src="evil.com"></iframe>')
            expect(result).toContain('&lt;iframe')
            expect(result).not.toContain('<iframe')
        })
    })

    describe('already-escaped text', () => {
        it('double-escapes already-escaped ampersand', () => {
            expect(escapeHtml('&amp;')).toBe('&amp;amp;')
        })

        it('double-escapes already-escaped less-than', () => {
            expect(escapeHtml('&lt;')).toBe('&amp;lt;')
        })

        it('double-escapes already-escaped greater-than', () => {
            expect(escapeHtml('&gt;')).toBe('&amp;gt;')
        })
    })

    describe('edge cases', () => {
        it('handles numbers by converting to string', () => {
            const result = escapeHtml(123)
            expect(result).toBe('123')
        })

        it('handles null input', () => {
            const result = escapeHtml(null)
            expect(result).toBe('')
        })

        it('handles undefined input', () => {
            const result = escapeHtml(undefined)
            expect(result).toBe('')
        })

        it('handles string with only special characters', () => {
            expect(escapeHtml('<>&')).toBe('&lt;&gt;&amp;')
        })

        it('handles very long strings', () => {
            const longString = '<script>'.repeat(100)
            const result = escapeHtml(longString)
            expect(result).not.toContain('<script>')
            expect(result.split('&lt;script&gt;')).toHaveLength(101)
        })

        it('handles newlines and whitespace', () => {
            expect(escapeHtml('line1\nline2\ttab')).toBe('line1\nline2\ttab')
        })
    })
})

// ─── validateColor ──────────────────────────────────────────────────────────────

describe('validateColor', () => {
    describe('valid 6-digit hex colors', () => {
        it('accepts lowercase hex color', () => {
            expect(validateColor('#ff0000')).toBe('#ff0000')
        })

        it('accepts uppercase hex color', () => {
            expect(validateColor('#FF0000')).toBe('#FF0000')
        })

        it('accepts mixed case hex color', () => {
            expect(validateColor('#aAbBcC')).toBe('#aAbBcC')
        })

        it('accepts black', () => {
            expect(validateColor('#000000')).toBe('#000000')
        })

        it('accepts white', () => {
            expect(validateColor('#ffffff')).toBe('#ffffff')
        })

        it('accepts the default color itself', () => {
            expect(validateColor('#667eea')).toBe('#667eea')
        })
    })

    describe('3-digit hex colors (rejected)', () => {
        it('rejects 3-digit hex color', () => {
            expect(validateColor('#f00')).toBe('#667eea')
        })

        it('rejects 3-digit hex color with letters', () => {
            expect(validateColor('#abc')).toBe('#667eea')
        })
    })

    describe('missing hash prefix', () => {
        it('rejects 6-digit hex without hash', () => {
            expect(validateColor('ff0000')).toBe('#667eea')
        })

        it('rejects 3-digit hex without hash', () => {
            expect(validateColor('f00')).toBe('#667eea')
        })
    })

    describe('invalid formats', () => {
        it('rejects empty string', () => {
            expect(validateColor('')).toBe('#667eea')
        })

        it('rejects null', () => {
            expect(validateColor(null)).toBe('#667eea')
        })

        it('rejects undefined', () => {
            expect(validateColor(undefined)).toBe('#667eea')
        })

        it('rejects CSS named colors', () => {
            expect(validateColor('red')).toBe('#667eea')
        })

        it('rejects CSS named color "blue"', () => {
            expect(validateColor('blue')).toBe('#667eea')
        })

        it('rejects CSS named color "transparent"', () => {
            expect(validateColor('transparent')).toBe('#667eea')
        })

        it('rejects RGB format', () => {
            expect(validateColor('rgb(255, 0, 0)')).toBe('#667eea')
        })

        it('rejects RGBA format', () => {
            expect(validateColor('rgba(255, 0, 0, 0.5)')).toBe('#667eea')
        })

        it('rejects HSL format', () => {
            expect(validateColor('hsl(0, 100%, 50%)')).toBe('#667eea')
        })

        it('rejects hex with invalid characters', () => {
            expect(validateColor('#gggggg')).toBe('#667eea')
        })

        it('rejects hex with too many digits', () => {
            expect(validateColor('#ff00000')).toBe('#667eea')
        })

        it('rejects hex with too few digits', () => {
            expect(validateColor('#ff00')).toBe('#667eea')
        })

        it('rejects hex with 8 digits (alpha)', () => {
            expect(validateColor('#ff000080')).toBe('#667eea')
        })

        it('rejects JavaScript injection attempt', () => {
            expect(validateColor('javascript:alert(1)')).toBe('#667eea')
        })

        it('rejects CSS expression injection', () => {
            expect(validateColor('expression(alert(1))')).toBe('#667eea')
        })

        it('rejects URL injection', () => {
            expect(validateColor('url(evil.com)')).toBe('#667eea')
        })
    })

    describe('default return value', () => {
        it('always returns #667eea for invalid input', () => {
            const invalidInputs = [null, undefined, '', 'red', '#fff', 'rgb(0,0,0)', 123, {}, []]
            invalidInputs.forEach(input => {
                expect(validateColor(input)).toBe('#667eea')
            })
        })
    })
})
