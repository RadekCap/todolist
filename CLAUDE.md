# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-page todo list application with user authentication, GTD workflow, projects, areas, recurring tasks, end-to-end encryption, and cloud sync via Supabase.

**Live URL:** https://radekcap.github.io/todolist/

## Architecture

### Modular Structure
The application uses ES6 modules with no build step. Code is organized across several top-level files and a `src/` directory:

```
index.html          - HTML structure only (no embedded CSS/JS)
app.js              - Application orchestrator (TodoApp class)
styles.css          - All styling (themes, responsive, density modes)
src/
  core/             - Foundation: Supabase client, state store, event bus
  services/         - Business logic: auth, todos, projects, areas, settings, export
  ui/               - Rendering: TodoList, GtdList, ProjectList, AreasDropdown, modals
  utils/            - Helpers: security (XSS), crypto (E2E encryption), dates, recurrence
```

### Layered Design

```
app.js (TodoApp)         ← Orchestrator: DOM refs, event listeners, modal management
    ↓ imports
src/ui/                  ← Rendering: builds DOM, handles display logic
    ↓ imports
src/services/            ← Business logic: Supabase CRUD, filtering, encryption
    ↓ imports
src/core/                ← Foundation: Supabase client, reactive Store, EventBus
src/utils/               ← Shared helpers: security, crypto, dates, recurrence
```

### Key Architectural Patterns

- **TodoApp class** (`app.js`): Orchestrator that coordinates modules. Holds DOM references, wires up event listeners, delegates to services and UI components.
- **Reactive Store** (`src/core/store.js`): Centralized state with `get()`, `set()`, `subscribe()`. Modules subscribe to state changes for reactive updates.
- **Event Bus** (`src/core/events.js`): Decoupled cross-module communication. Services emit events (e.g., `TODO_ADDED`), UI subscribes and re-renders.
- **Service modules** (`src/services/`): Each service handles one domain (todos, projects, areas, etc.) with async Supabase operations.
- **UI components** (`src/ui/`): Render functions that read from the store and build DOM elements.

### Data Flow
```
Supabase Auth → User Login → Load All Data → Render UI
                                              ↓
User Actions → Service Function → Update Supabase → Emit Event → Re-render
```

## Build & Test Commands

```bash
# No build step — static files served directly

# Unit tests (Vitest, ~1000+ tests)
npm run test:unit                          # run all unit tests
npm run test:unit:coverage                 # run with v8 coverage
npx vitest run tests/unit/todos.test.js    # run a single test file
npx vitest run -t "test name pattern"      # run tests matching a name

# E2E tests (Playwright, requires env vars)
# Set TEST_USER_EMAIL and TEST_USER_PASSWORD for the Supabase test account
TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npm test          # run all e2e
TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npx playwright test tests/e2e/todos.spec.js  # single file
npx playwright test --headed               # run with visible browser

# CSS validation (also runs as pre-commit hook)
npm run check:css
```

### Test Infrastructure

- **Unit tests** (`tests/unit/`): Vitest with node environment. Supabase is mocked via `tests/unit/helpers/supabase-mock.js` (`createSupabaseMock()` with `_queueResult()` and `_reset()`).
- **E2E tests** (`tests/e2e/`): Playwright against a live Supabase instance. Global setup seeds test categories, contexts, priorities, and projects. Uses `npx serve -l 3000` as the local server.
- **Coverage config**: v8 provider, includes `src/**/*.js`, excludes `src/ui/` (UI is covered by E2E).

### Unit Test Gotchas

- `escapeHtml()` uses `document.createElement` → needs `// @vitest-environment jsdom` directive
- Supabase chained queries need thenable mock: `then: vi.fn((resolve) => resolve(result))`
- Use `enc:` prefix in encrypt mock for clearer test assertions
- **Node 22 localStorage issue:** `globalThis.localStorage` is Node's experimental stub (no `.clear()`, `.removeItem()`). Fix: mock localStorage on `globalThis` explicitly
- `crypto.test.js` uses real Web Crypto API (no mocking needed in Node 18+)

## Database (Supabase)

**Connection:** `src/core/supabase.js`
- URL: `https://rkvmujdayjmszmyzbhal.supabase.co`
- Uses Supabase JavaScript client from CDN (`@supabase/supabase-js@2.47.0`)

### Tables
- **`todos`**: id, user_id, text, completed, category_id, due_date, gtd_status, context_id, comment, is_template, recurrence_rule, next_occurrence, parent_template_id, created_at
- **`categories`**: id, user_id, name, color, created_at
- **`projects`**: id, user_id, name, description, color, display_order, area_id, created_at
- **`areas`**: id, user_id, name, color, created_at
- **`contexts`**: id, user_id, name, created_at
- **`priorities`**: id, user_id, name, color, level, created_at
- **`user_settings`**: id, user_id, theme, username, encryption_salt, density_mode, created_at

### Row Level Security (RLS)
All tables use RLS policies to ensure users only access their own data:
```sql
auth.uid() = user_id
```

### Database Migrations
Migration files live in `migrations/` (001 through 014), each containing SQL with table creation, RLS policies, triggers, and indexes.

To add new database features:
1. Create a new migration file in `migrations/` (e.g., `015_description.sql`)
2. Run migration in Supabase SQL Editor
3. Update the relevant service in `src/services/` to read/write the new field
4. Update UI components in `src/ui/` as needed

## Security Patterns

### XSS Prevention
**Always use these functions from `src/utils/security.js`:**

```javascript
import { escapeHtml, validateColor } from './src/utils/security.js'

// CORRECT - Prevents XSS
li.innerHTML = `<span>${escapeHtml(todo.text)}</span>`
li.style.color = validateColor(category.color)

// WRONG - Vulnerable to XSS
li.innerHTML = `<span>${todo.text}</span>`
li.style.color = category.color

// Setting element properties directly (safe - no HTML parsing)
element.textContent = userInput
```

### End-to-End Encryption
- Uses AES-256-GCM via Web Crypto API (`src/utils/crypto.js`)
- PBKDF2 key derivation from user password
- Todo text and category names are encrypted before storage
- Encryption is optional and managed per-user

### Authentication
- Supabase handles all auth (email/password)
- Session managed automatically
- `auth.uid()` used in RLS policies

## Modal Pattern

Modals are used for adding/editing todos, managing projects, managing areas, import/export, and settings.

- Modals have `role="dialog"`, `aria-modal="true"`, `aria-labelledby` for accessibility
- ESC key closes modals (event listener added/removed in open/close)
- Focus returns to trigger button after closing
- Pre-selects current context (GTD status, project, etc.) when opened

**When adding new modals:**
1. Add HTML structure in `index.html` with ARIA attributes
2. Create modal class or functions in `src/ui/modals/`
3. Wire up open/close in `app.js`
4. Implement ESC key handler with cleanup
5. Manage focus (trap and return)

## CI/CD

### GitHub Actions Workflows
- **`auto-version-bump.yml`**: Auto-increments PATCH version on merge to main, updates `APP_VERSION` in `app.js` and `VERSION.md`
- **`css-selector-check.yml`**: Validates CSS selectors in `styles.css` match elements in `index.html`
- **`deploy-pages.yml`**: Deploys to GitHub Pages from root directory
- **`e2e-tests.yml`**: Runs Playwright tests in grouped shards (auth, todos, projects, etc.) on PRs
- **`unit-tests.yml`**: Runs Vitest on PRs

### Pre-commit Hook
- Installed via `npm install` (runs `scripts/setup-hooks.js`)
- Validates CSS selectors before each commit
- Run manually: `npm run check:css`

## Deployment

**GitHub Pages:** Deployed from `main` branch, root directory. Auto-deploys on push to main. No build step — static files served directly.

## Code Style

- **ES6 modules** - Use `import`/`export`, no CommonJS
- **Async/await** for all Supabase operations (not `.then()`)
- **Follow existing patterns** - Services export functions, UI exports render functions
- **Security first** - Always use `escapeHtml()` and `validateColor()`
- **Accessibility** - Include ARIA attributes for dynamic content
- **No build step** - All code must work as static files served directly

## Pull Request Workflow

1. **Security-focused code reviews** - All user input must be sanitized
2. **Accessibility checks** - ARIA attributes, keyboard navigation
3. **CSS validation** - Ensure `npm run check:css` passes
4. **Browser testing** - Test in Chrome, Firefox, Safari, Edge
5. **Database changes** - Include migration SQL file in `migrations/`
