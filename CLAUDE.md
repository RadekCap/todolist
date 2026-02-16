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

## File Reference

### Top-Level Files

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~850 | HTML structure: auth forms, sidebar, toolbar, modals |
| `app.js` | ~1170 | TodoApp orchestrator class |
| `styles.css` | ~5260 | All CSS: themes (Glass/Dark/Clear), density, responsive |
| `package.json` | - | Dev dependencies for CSS validation only |

### src/core/

| File | Purpose |
|------|---------|
| `supabase.js` | Supabase client initialization (CDN import) |
| `store.js` | Reactive state store singleton |
| `events.js` | Event bus singleton + `Events` enum constants |

### src/services/

| File | Purpose |
|------|---------|
| `auth.js` | Login, signup, logout, encryption key management |
| `todos.js` | Todo CRUD, filtering, GTD counts, recurrence, selection |
| `projects.js` | Project CRUD, area assignment |
| `areas.js` | Area CRUD, keyboard shortcuts (Shift+1-9) |
| `categories.js` | Category loading |
| `contexts.js` | Context loading (@home, @work) |
| `priorities.js` | Priority loading |
| `settings.js` | User preferences: theme, density, notifications |
| `export.js` | Export to Text/JSON/CSV/XML |
| `quotes.js` | Daily motivational quote for empty Inbox |

### src/ui/

| File | Purpose |
|------|---------|
| `TodoList.js` | Todo list rendering with date grouping, status badges |
| `GtdList.js` | GTD status sidebar (Inbox, Next, Scheduled, Waiting, Someday, Done) |
| `ProjectList.js` | Project sidebar, management modal, drag-and-drop reordering |
| `AreasDropdown.js` | Area toolbar dropdown and management |
| `SelectionBar.js` | Multi-select bulk operations bar |
| `modals/TodoModal.js` | Add/edit todo form with recurrence UI |
| `modals/ExportModal.js` | Export format selection |
| `modals/ImportModal.js` | Import with file parsing and batch insert |

### src/utils/

| File | Purpose |
|------|---------|
| `security.js` | `escapeHtml()` and `validateColor()` for XSS prevention |
| `crypto.js` | AES-256-GCM encryption with PBKDF2 key derivation |
| `dates.js` | Date formatting, grouping (Overdue/Today/Tomorrow) |
| `recurrence.js` | Recurring task rule building and occurrence calculation |

### Other Directories

| Directory | Purpose |
|-----------|---------|
| `migrations/` | 14 SQL migration files for progressive schema updates |
| `mcp-server/` | MCP protocol server for Claude AI integration |
| `scripts/` | CSS selector validation, git hook setup |
| `supabase/` | Local dev config, edge functions |
| `.github/workflows/` | CI/CD: auto version bump, CSS validation, GitHub Pages deploy |

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

// Escapes HTML entities to prevent XSS
escapeHtml(text)

// Validates hex color format, returns default if invalid
validateColor(color)
```

**Usage:**
```javascript
// CORRECT - Prevents XSS
li.innerHTML = `<span>${escapeHtml(todo.text)}</span>`
li.style.color = validateColor(category.color)

// WRONG - Vulnerable to XSS
li.innerHTML = `<span>${todo.text}</span>`
li.style.color = category.color
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

The application uses modals for adding/editing todos, managing projects, managing areas, import/export, and settings.

**Key implementation details:**
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

## Common Development Workflows

### Adding a New Database Column

1. **Create migration file** in `migrations/`:
   ```sql
   ALTER TABLE todos ADD COLUMN new_field TYPE;
   ```

2. **Run migration** in Supabase SQL Editor

3. **Update service** in `src/services/` to read/write the field:
   ```javascript
   // In the relevant service function:
   const { data, error } = await supabase
       .from('todos')
       .insert({ ..., new_field: value })
   ```

4. **Update UI** in `src/ui/` to display the field

### Adding a New Modal Form Field

1. **Add HTML** in `index.html` within the modal's form:
   ```html
   <div class="modal-sidebar-field">
       <label for="modalNewField">
           <span class="modal-field-label">field name</span>
       </label>
       <input type="text" id="modalNewField" class="modal-sidebar-input">
   </div>
   ```

2. **Get DOM reference** in the modal class (`src/ui/modals/TodoModal.js`):
   ```javascript
   this.newField = document.getElementById('modalNewField')
   ```

3. **Use in submit handler** and **clear on close**

### Adding a New Service

1. Create `src/services/newservice.js` with async functions
2. Import `supabase` from `src/core/supabase.js`
3. Import `store` and `events` as needed
4. Export from `src/services/index.js`
5. Import and use in `app.js`

### Handling User Input

**Always sanitize before rendering:**
```javascript
import { escapeHtml, validateColor } from './src/utils/security.js'

// Text content in innerHTML
element.innerHTML = `<span>${escapeHtml(userInput)}</span>`

// Colors from user/database
element.style.backgroundColor = validateColor(userColor)

// Setting element properties directly (safe - no HTML parsing)
element.textContent = userInput
```

## CI/CD

### GitHub Actions Workflows
- **`auto-version-bump.yml`**: Auto-increments PATCH version on merge to main, updates `APP_VERSION` in `app.js` and `VERSION.md`
- **`css-selector-check.yml`**: Validates CSS selectors in `styles.css` match elements in `index.html`
- **`deploy-pages.yml`**: Deploys to GitHub Pages from root directory

### Pre-commit Hook
- Installed via `npm install` (runs `scripts/setup-hooks.js`)
- Validates CSS selectors before each commit
- Run manually: `npm run check:css`

## Deployment

**GitHub Pages:**
- Deployed from `main` branch, root directory
- Auto-deploys on push to main
- No build step required - static files served directly

## Testing Locally

1. Clone repository
2. Run `npm install` (installs dev dependencies and pre-commit hook)
3. Open `index.html` in a browser
4. Application connects to production Supabase (no local DB needed)

**Note:** All users share the same Supabase instance but are isolated by RLS policies.

## Pull Request Workflow

When creating PRs:
1. **Security-focused code reviews** - All user input must be sanitized
2. **Accessibility checks** - ARIA attributes, keyboard navigation
3. **CSS validation** - Ensure `npm run check:css` passes
4. **Browser testing** - Test in Chrome, Firefox, Safari, Edge
5. **Database changes** - Include migration SQL file in `migrations/`

## Code Style

- **ES6 modules** - Use `import`/`export`, no CommonJS
- **Async/await** for all Supabase operations (not `.then()`)
- **Follow existing patterns** - Services export functions, UI exports render functions
- **Error handling** - Log to console, show user-friendly messages
- **Security first** - Always use `escapeHtml()` and `validateColor()`
- **Accessibility** - Include ARIA attributes for dynamic content
- **No build step** - All code must work as static files served directly
