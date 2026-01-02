# Version History

This file tracks the version history of the TodoList application.

## Versioning System

The application follows [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.0.0)
- **MAJOR**: Breaking changes or major feature releases
- **MINOR**: New features added in a backward-compatible manner
- **PATCH**: Backward-compatible bug fixes

### How Versioning Works

**Automatic Version Increment (PATCH):**
- When a PR is merged to `main`, GitHub Actions automatically increments the PATCH version
- Example: 1.0.0 → 1.0.1 → 1.0.2
- The workflow updates both `index.html` and `VERSION.md`
- Changes are committed automatically by `github-actions[bot]`

**Manual Version Update (MINOR/MAJOR):**
When preparing a feature release or breaking change:

1. **New features**: Manually update to next MINOR version (e.g., 1.0.5 → 1.1.0)
2. **Breaking changes**: Manually update to next MAJOR version (e.g., 1.5.0 → 2.0.0)

**IMPORTANT - Handling Manual Version Bumps:**
- ⚠️ **Do NOT include version bumps in your PR** - The auto-increment workflow will run after merge
- ✅ **Correct workflow**: Merge PR → Auto-increment runs → Manually update to MINOR/MAJOR in a separate commit
- ❌ **Incorrect**: Update to 1.1.0 in PR → Merge → Auto-increment to 1.1.1 (skips intended 1.1.0)

To manually update version (AFTER PR merge):
1. Wait for auto-increment commit to complete
2. Edit `APP_VERSION` constant in `index.html` (line ~875)
3. Update "Current Version" at the bottom of this file
4. Commit with message: `chore: Bump version to X.Y.Z`
5. Push directly to `main` (no PR needed for version-only changes)

---

## Changelog

### Version 1.0.0 (Current)
**Release Date:** TBD

**Initial Release** - First versioned release of the TodoList application.

**Features:**
- User authentication (login/signup)
- Todo CRUD operations (create, read, update, delete)
- Category management with color coding
- Priority system for todos
- Due date tracking with visual indicators (overdue, today, upcoming)
- Modal-based todo creation form
- Responsive design (mobile and desktop)
- Safari compatibility fixes
- Security features (XSS prevention, color validation)
- Accessibility support (ARIA labels, keyboard navigation)
- Application versioning system

**Technical Stack:**
- Frontend: Vanilla JavaScript (ES6+)
- Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth
- Styling: CSS3 with gradients and transitions
- Deployment: GitHub Pages

**Database Schema:**
- `todos` table: id, user_id, text, completed, category_id, priority_id, due_date, created_at
- `categories` table: id, user_id, name, color, created_at
- `priorities` table: id, user_id, name, color, level, created_at

**Known Issues:**
- None currently identified

---

## Future Versions

### Planned for 1.1.0
- Settings page for priority management
- Priority filter in sidebar
- Default priorities for new users
- Drag-and-drop priority reordering

### Planned for 1.2.0
- Todo editing functionality
- Recurring tasks
- Task notes/descriptions
- Search and filter improvements

---

## Version Update Details

### Automatic Updates (via GitHub Actions)
- **PATCH versions** are incremented automatically when PRs merge to `main`
- Workflow file: `.github/workflows/auto-version-bump.yml`
- Updates: `index.html` (APP_VERSION) and `VERSION.md` (Current Version)
- No manual intervention required

### Manual Release Checklist (MINOR/MAJOR versions)

When preparing a feature or breaking change release:

- [ ] Manually update `APP_VERSION` constant in `index.html`
- [ ] Update this `VERSION.md` file with changelog entry
- [ ] Update "Current Version" at bottom of this file
- [ ] Commit: `chore: Bump version to X.Y.Z`
- [ ] Create git tag: `git tag vX.Y.Z`
- [ ] Push tag: `git push origin vX.Y.Z`
- [ ] Create GitHub release with release notes
- [ ] Update README.md if needed

---

**Current Version:** 1.0.56
**Last Updated:** 2026-01-02
