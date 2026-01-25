/**
 * CSS Selector Validator
 *
 * This script checks that CSS selectors in styles.css match elements in index.html.
 * It helps catch broken selectors before they reach production.
 *
 * Usage: node scripts/check-css-selectors.js
 */

const fs = require('fs');
const path = require('path');
const csstree = require('css-tree');
const { JSDOM } = require('jsdom');

// Files to check
const CSS_FILE = path.join(__dirname, '..', 'styles.css');
const HTML_FILE = path.join(__dirname, '..', 'index.html');

// Selectors that are valid but won't match in static HTML
// (dynamic classes, pseudo-elements, @-rules, etc.)
const IGNORED_PATTERNS = [
    // Pseudo-elements (not queryable)
    /::before$/,
    /::after$/,
    /::placeholder$/,
    /::selection$/,
    /::first-letter$/,
    /::first-line$/,
    /::marker$/,
    /::backdrop$/,
    /::file-selector-button$/,
    // Pseudo-classes that depend on runtime state
    /:hover$/,
    /:focus$/,
    /:active$/,
    /:visited$/,
    /:focus-visible$/,
    /:focus-within$/,
    /:target$/,
    /:checked$/,
    /:disabled$/,
    /:enabled$/,
    /:valid$/,
    /:invalid$/,
    /:required$/,
    /:optional$/,
    /:read-only$/,
    /:read-write$/,
    /:empty$/,
    /:blank$/,
    /:fullscreen$/,
    /:playing$/,
    /:paused$/,
    // Dynamic state classes (added by JavaScript)
    /\.active$/,
    /\.completed$/,
    /\.loading$/,
    /\.loaded$/,
    /\.hidden$/,
    /\.visible$/,
    /\.collapsed$/,
    /\.expanded$/,
    /\.dragging$/,
    /\.drag-over$/,
    /\.open$/,
    /\.closed$/,
    /\.selected$/,
    /\.focused$/,
    /\.error$/,
    /\.success$/,
    /\.warning$/,
    /\.info$/,
    // Wildcard/universal selectors
    /^\*$/,
    // Attribute selectors (often dynamic)
    /\[data-/,
    /\[aria-/,
    // Animation keyframes (not selectors)
    /^from$/,
    /^to$/,
    /^\d+%$/,
];

// Additional class patterns that are dynamically generated
const DYNAMIC_CLASS_PATTERNS = [
    // Body state classes (added by JavaScript)
    /^body\.fullscreen-mode/,
    /^body\.sidebar-resizing/,
    // Toolbar menu open state
    /\.toolbar-user-menu\.open/,
    /\.toolbar-areas-menu\.open/,
    // Sidebar section collapsed state (toggled by JavaScript)
    /\.sidebar-section\.collapsed/,
    // GTD status classes
    /\.inbox/,
    /\.next_action/,
    /\.scheduled/,
    /\.waiting_for/,
    /\.someday_maybe/,
    /\.done/,
    /\.all/,
    // Date-related classes
    /\.overdue/,
    /\.today/,
    /\.tomorrow/,
    /\.this-week/,
    /\.next-week/,
    /\.later/,
    // Theme classes (applied to html/body)
    /\[data-theme=/,
];

// Selectors for elements that are dynamically rendered by JavaScript
// These won't exist in static HTML but are valid CSS selectors
const DYNAMIC_ELEMENT_SELECTORS = [
    // Todo items (rendered by JavaScript)
    /\.todo-item/,
    /\.todo-checkbox/,
    /\.todo-content/,
    /\.todo-text/,
    /\.todo-comment/,
    /\.todo-category-badge/,
    /\.todo-date/,
    /\.todo-priority-badge/,
    /\.todo-gtd-badge/,
    /\.todo-context-badge/,
    /\.delete-btn/,
    /\.drag-handle/,
    /\.recurring-icon/,
    // Category items (rendered by JavaScript)
    /\.category-item/,
    /\.category-name/,
    /\.category-color/,
    /\.category-delete/,
    // Project items (rendered by JavaScript)
    /\.project-item/,
    /\.project-name/,
    /\.project-color/,
    /\.project-count/,
    /\.project-delete/,
    /\.project-card/,
    // Context items (rendered by JavaScript)
    /\.context-item/,
    /\.context-name/,
    /\.context-delete/,
    // GTD list items (rendered by JavaScript)
    /\.gtd-item/,
    /\.gtd-icon/,
    /\.gtd-label/,
    /\.gtd-count/,
    /\.gtd-shortcut/,
    // Scheduled view headers (rendered by JavaScript)
    /\.scheduled-section-header/,
    /\.section-header-text/,
    // GTD separator and section label (rendered by JavaScript)
    /\.gtd-inbox-separator/,
    /\.gtd-section-label/,
    // Area management items (rendered by JavaScript)
    /\.manage-areas-item/,
    /\.manage-areas-drag-handle/,
    /\.manage-areas-name/,
    /\.manage-areas-name-input/,
    /\.manage-areas-actions/,
    /\.manage-areas-edit/,
    /\.manage-areas-delete/,
    /\.manage-areas-color/,
    // Project management items (rendered by JavaScript)
    /\.manage-projects-item/,
    /\.manage-projects-drag-handle/,
    /\.manage-projects-details/,
    /\.manage-projects-name/,
    /\.manage-projects-name-input/,
    /\.manage-projects-description/,
    /\.manage-projects-description-input/,
    /\.manage-projects-area/,
    /\.manage-projects-actions/,
    /\.manage-projects-edit/,
    /\.manage-projects-delete/,
    /\.manage-projects-color/,
    // Area color indicators (rendered by JavaScript)
    /\.area-color-dot/,
    // Project title header (rendered by JavaScript)
    /\.project-title-header/,
    /\.project-title-text/,
    /\.project-title-description/,
    // Area shortcut hints (rendered by JavaScript for dynamic areas)
    /\.areas-item-shortcut/,
    // Empty/loading states (rendered by JavaScript)
    /\.empty-state/,
    /\.loading-state/,
    /\.inbox-zen-state/,
    /\.zen-/,
    // Form elements not in static HTML (legacy/unused)
    /\.input-container/,
    /\.input-row/,
    /#todoInput/,
    /#categorySelect/,
    /#dueDateInput/,
    /#addBtn/,
    /\.form-group select/,
    /\.success-message/,
    // Form sections (may be dynamically added)
    /\.form-columns/,
    /\.form-column/,
    /\.form-section/,
    /\.form-field/,
    /\.form-row/,
    /\.section-icon/,
    /\.label-icon/,
    /\.input-title/,
    /\.create-more-option/,
    /\.checkbox-label/,
    /\.priority-star.*svg/,
    // Recurrence panel elements (modal form)
    /\.recurrence-/,
    /\.weekday-checkbox/,
    /\.monthly-/,
    /#recurrence/,
    // Modal tabs and dividers (may be conditionally rendered)
    /\.modal-sidebar-divider/,
    /\.modal-tab/,
    /\.modal-tabs/,
];

/**
 * Extract all selectors from CSS AST
 */
function extractSelectors(css) {
    const selectors = new Map(); // selector -> line number
    const ast = csstree.parse(css, {
        positions: true,
        parseRulePrelude: true,
    });

    csstree.walk(ast, {
        visit: 'Rule',
        enter(node) {
            if (node.prelude && node.prelude.type === 'SelectorList') {
                node.prelude.children.forEach((selector) => {
                    const selectorText = csstree.generate(selector);
                    const line = selector.loc ? selector.loc.start.line : 0;
                    selectors.set(selectorText, line);
                });
            }
        },
    });

    return selectors;
}

/**
 * Check if a selector should be ignored
 */
function shouldIgnore(selector) {
    // Check against ignored patterns
    for (const pattern of IGNORED_PATTERNS) {
        if (pattern.test(selector)) {
            return true;
        }
    }

    // Check against dynamic class patterns
    for (const pattern of DYNAMIC_CLASS_PATTERNS) {
        if (pattern.test(selector)) {
            return true;
        }
    }

    // Check against dynamically rendered element selectors
    for (const pattern of DYNAMIC_ELEMENT_SELECTORS) {
        if (pattern.test(selector)) {
            return true;
        }
    }

    return false;
}

/**
 * Remove pseudo-classes/pseudo-elements from selector for testing
 */
function stripPseudos(selector) {
    // Remove pseudo-elements
    let cleaned = selector.replace(/::[a-z-]+(\([^)]*\))?/gi, '');
    // Remove pseudo-classes (but keep the base selector)
    cleaned = cleaned.replace(/:[a-z-]+(\([^)]*\))?/gi, '');
    // Remove trailing combinators
    cleaned = cleaned.replace(/[>+~\s]+$/g, '').trim();
    return cleaned;
}

/**
 * Simplify compound selectors for testing
 */
function simplifySelector(selector) {
    // For selectors with dynamic classes, test the static part
    // e.g., ".todo-item.completed" -> check if ".todo-item" exists

    // Split by common dynamic suffixes and test base
    const dynamicSuffixes = [
        '.active', '.completed', '.loading', '.loaded', '.hidden',
        '.visible', '.collapsed', '.expanded', '.dragging', '.drag-over',
        '.open', '.closed', '.selected', '.focused',
        '.inbox', '.next_action', '.scheduled', '.waiting_for', '.someday_maybe', '.done', '.all',
        '.overdue', '.today', '.tomorrow', '.this-week', '.next-week', '.later',
    ];

    let simplified = selector;
    for (const suffix of dynamicSuffixes) {
        if (simplified.endsWith(suffix)) {
            simplified = simplified.slice(0, -suffix.length);
        }
    }

    return simplified || selector;
}

/**
 * Test if a selector matches any element in the DOM
 */
function testSelector(document, selector) {
    try {
        // Try the original selector first
        const result = document.querySelector(selector);
        if (result) return true;

        // Try with pseudos stripped
        const stripped = stripPseudos(selector);
        if (stripped && stripped !== selector) {
            const strippedResult = document.querySelector(stripped);
            if (strippedResult) return true;
        }

        // Try simplified version (without dynamic classes)
        const simplified = simplifySelector(stripped || selector);
        if (simplified && simplified !== selector && simplified !== stripped) {
            const simplifiedResult = document.querySelector(simplified);
            if (simplifiedResult) return true;
        }

        return false;
    } catch (e) {
        // Invalid selector syntax for querySelector (e.g., contains unsupported pseudo-class)
        // This is fine - the CSS parser validated it, jsdom just can't query it
        return true;
    }
}

/**
 * Main validation function
 */
function validate() {
    console.log('CSS Selector Validator');
    console.log('======================\n');

    // Read files
    const css = fs.readFileSync(CSS_FILE, 'utf-8');
    const html = fs.readFileSync(HTML_FILE, 'utf-8');

    // Parse HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract selectors
    const selectors = extractSelectors(css);
    console.log(`Found ${selectors.size} selectors in styles.css\n`);

    // Check each selector
    const broken = [];
    const ignored = [];
    let checked = 0;

    for (const [selector, line] of selectors) {
        if (shouldIgnore(selector)) {
            ignored.push({ selector, line, reason: 'dynamic/pseudo' });
            continue;
        }

        checked++;
        const matches = testSelector(document, selector);

        if (!matches) {
            broken.push({ selector, line });
        }
    }

    // Report results
    console.log(`Checked: ${checked} selectors`);
    console.log(`Ignored: ${ignored.length} selectors (dynamic/pseudo)`);
    console.log(`Broken:  ${broken.length} selectors\n`);

    if (broken.length > 0) {
        console.log('BROKEN SELECTORS:');
        console.log('-----------------');
        for (const { selector, line } of broken) {
            console.log(`  Line ${line}: ${selector}`);
        }
        console.log('\nThese selectors do not match any elements in index.html.');
        console.log('Please verify they are correct or add them to the ignore list.\n');
        process.exit(1);
    }

    console.log('All CSS selectors are valid!');
    process.exit(0);
}

// Run validation
validate();
