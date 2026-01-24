#!/usr/bin/env node
/**
 * Setup Git Hooks
 *
 * This script is run automatically via `npm install` (via the "prepare" script).
 * It installs the pre-commit hook to run CSS selector validation.
 */

const fs = require('fs');
const path = require('path');

const GIT_HOOKS_DIR = path.join(__dirname, '..', '.git', 'hooks');
const PRE_COMMIT_HOOK = path.join(GIT_HOOKS_DIR, 'pre-commit');

const HOOK_CONTENT = `#!/bin/sh
# Pre-commit hook: Run CSS selector validation
# Installed by: npm install (via scripts/setup-hooks.js)

# Only run if styles.css or index.html are staged
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if echo "$STAGED_FILES" | grep -qE "(styles\\.css|index\\.html)$"; then
    echo "Running CSS selector check..."

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "Warning: node_modules not found. Run 'npm install' first."
        echo "Skipping CSS selector check."
        exit 0
    fi

    # Run the CSS selector check
    node scripts/check-css-selectors.js

    if [ $? -ne 0 ]; then
        echo ""
        echo "CSS selector check failed!"
        echo "Please fix the broken selectors before committing."
        echo ""
        echo "To add a selector to the ignore list, edit:"
        echo "  scripts/check-css-selectors.js"
        echo ""
        exit 1
    fi

    echo "CSS selector check passed!"
fi

exit 0
`;

function setup() {
    // Check if .git directory exists
    if (!fs.existsSync(GIT_HOOKS_DIR)) {
        console.log('Not a git repository or .git/hooks not found. Skipping hook setup.');
        return;
    }

    // Write the pre-commit hook
    fs.writeFileSync(PRE_COMMIT_HOOK, HOOK_CONTENT, { mode: 0o755 });
    console.log('Pre-commit hook installed successfully.');
    console.log('CSS selector validation will run before each commit.');
}

setup();
