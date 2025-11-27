# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-page todo list application with user authentication, categories, and cloud sync. The entire application is contained in one HTML file with embedded CSS and JavaScript.

**Live URL:** https://radekcap.github.io/todolist/

## Architecture

### Single-File Structure
All code lives in `index.html`:
- HTML structure (authentication forms, modal, todo UI)
- CSS styling (embedded `<style>` tag, ~700 lines)
- JavaScript application logic (embedded `<script type="module">`, ~600 lines)

### Class-Based Design
The application uses a single `TodoApp` class that manages:
- **State**: `currentUser`, `todos`, `categories`, `selectedCategoryId`
- **Lifecycle**: Authentication flow, data loading, rendering
- **Event handling**: User interactions with todos, categories, and modals

### Data Flow
```
Supabase Auth → User Login → Load Categories & Todos → Render UI
                                                      ↓
User Actions → Update Supabase → Reload Data → Re-render UI
```

## Database (Supabase)

**Connection:** Embedded in index.html (lines ~805-807)
- URL: `https://rkvmujdayjmszmyzbhal.supabase.co`
- Uses Supabase JavaScript client from CDN

### Tables
- **`todos`**: id, user_id, text, completed, category_id, due_date, created_at
- **`categories`**: id, user_id, name, color, created_at
- **`priorities`** (future): id, user_id, name, color, level, created_at

### Row Level Security (RLS)
All tables use RLS policies to ensure users only access their own data:
```sql
auth.uid() = user_id
```

### Database Migrations
- **DATABASE_MIGRATION.md**: Raw SQL for migrations
- **IMPLEMENTATION_GUIDE.md**: Step-by-step Supabase UI guide

To add new database features:
1. Write SQL in DATABASE_MIGRATION.md
2. Create step-by-step guide if complex
3. Update frontend to use new schema

## Security Patterns

### XSS Prevention
**Always use these methods for user-generated content:**

```javascript
escapeHtml(text)      // Escapes HTML entities (index.html:1161)
validateColor(color)  // Validates hex colors (index.html:1167)
```

**Usage:**
```javascript
// ✅ CORRECT - Prevents XSS
li.innerHTML = `<span>${this.escapeHtml(todo.text)}</span>`
li.style.color = this.validateColor(category.color)

// ❌ WRONG - Vulnerable to XSS
li.innerHTML = `<span>${todo.text}</span>`
li.style.color = category.color
```

### Authentication
- Supabase handles all auth (email/password)
- Session managed automatically
- `auth.uid()` used in RLS policies

## Modal Pattern

The application uses a modal for adding todos instead of inline forms.

**Key implementation details:**
- Modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby` for accessibility
- ESC key closes modal (event listener added/removed in open/close)
- Focus returns to trigger button after closing
- Pre-selects current category when opened

**When adding new modals:**
1. Add ARIA attributes for accessibility
2. Implement ESC key handler with cleanup
3. Manage focus (trap and return)
4. Pre-populate contextual data

## Safari Compatibility

**Issue:** Safari doesn't update `<select>` elements reliably during synchronous DOM operations.

**No longer needed:** The inline form was replaced with a modal, eliminating the Safari-specific `setTimeout(0)` workaround that was previously required.

## Key Methods Reference

### TodoApp Class Methods

**Data Operations:**
- `loadCategories()` - Fetches from Supabase, calls `renderCategories()` and `updateCategorySelect()`
- `loadTodos()` - Fetches from Supabase, calls `renderTodos()`
- `addTodo()` - Inserts to Supabase, closes modal, re-renders
- `toggleTodo(id)` - Updates completion status
- `deleteTodo(id)` - Removes from Supabase and local state

**Rendering:**
- `renderCategories()` - Builds sidebar category list with event listeners
- `renderTodos()` - Builds todo list items with checkboxes and delete buttons
- `updateCategorySelect()` - Rebuilds modal category dropdown options

**Category Filtering:**
- `selectCategory(categoryId)` - Sets filter (null = all, 'uncategorized', or UUID)
- `getFilteredTodos()` - Returns todos based on `selectedCategoryId`

**Modal Management:**
- `openModal()` - Shows modal, pre-selects category, adds ESC listener, focuses input
- `closeModal()` - Hides modal, removes ESC listener, returns focus to button

## Common Development Workflows

### Adding a New Database Column

1. **Update DATABASE_MIGRATION.md** with SQL:
   ```sql
   ALTER TABLE todos ADD COLUMN new_field TYPE;
   ```

2. **Run migration** in Supabase SQL Editor

3. **Update frontend** to read/write the field:
   ```javascript
   // In addTodo():
   .insert({
       user_id: this.currentUser.id,
       text: text,
       new_field: value  // Add new field
   })
   ```

4. **Update UI** to display the field

### Adding a New Modal Form Field

1. **Add to modal HTML** with proper label and ARIA:
   ```html
   <div>
       <label for="modalNewField">Field Name (optional)</label>
       <input type="text" id="modalNewField">
   </div>
   ```

2. **Get DOM reference** in constructor:
   ```javascript
   this.modalNewField = document.getElementById('modalNewField')
   ```

3. **Use in addTodo()**:
   ```javascript
   const newFieldValue = this.modalNewField.value || null
   ```

4. **Clear in closeModal()**:
   ```javascript
   this.modalNewField.value = ''
   ```

### Handling User Input

**Always sanitize before rendering:**
```javascript
// Text content
element.innerHTML = `<span>${this.escapeHtml(userInput)}</span>`

// Colors from user/database
element.style.backgroundColor = this.validateColor(userColor)

// Setting element properties directly (safe)
element.textContent = userInput  // Safe - no HTML parsing
```

## Deployment

**GitHub Pages:**
- Deployed from `master` branch, root directory
- Auto-deploys on push to master (configured in repo settings)
- Deployment time: ~30-60 seconds after merge

**No build step required** - it's a static HTML file

## Testing Locally

1. Clone repository
2. Open `index.html` in a browser
3. Application connects to production Supabase (no local DB needed)

**Note:** All users share the same Supabase instance but are isolated by RLS policies.

## Pull Request Workflow

When creating PRs:
1. **Security-focused code reviews** - All user input must be sanitized
2. **Accessibility checks** - Copilot reviews for ARIA attributes, keyboard navigation
3. **Browser testing** - Test in Chrome, Firefox, Safari, Edge
4. **Database changes** - Include migration SQL and step-by-step guide

## Current Feature Branches

- **Priority system** (PR #16): Database schema ready, frontend pending
- **Modal forms** (PR #15): Completed, includes accessibility improvements

## Code Style

- **Use existing patterns** - Follow TodoApp class structure
- **Async/await** for all Supabase operations (not `.then()`)
- **Error handling** - Log to console, show user-friendly messages
- **Security first** - Always use `escapeHtml()` and `validateColor()`
- **Accessibility** - Include ARIA attributes for dynamic content
