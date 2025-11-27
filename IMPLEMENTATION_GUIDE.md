# Step-by-Step Database Migration Guide for PR #16

This guide provides detailed, step-by-step instructions for implementing the database changes required for the todo priority feature.

## Prerequisites

- Access to your Supabase dashboard
- Project URL: https://rkvmujdayjmszmyzbhal.supabase.co

## Overview

You will be:
1. Creating a new `priorities` table
2. Adding a `priority_id` column to the existing `todos` table
3. Setting up Row Level Security (RLS) policies
4. Optionally creating default priorities for existing users

**Estimated time:** 10-15 minutes

---

## Step 1: Access Supabase SQL Editor

### 1.1 Open Supabase Dashboard
1. Navigate to https://supabase.com/dashboard
2. Sign in to your account
3. Select your **todolist** project

### 1.2 Open SQL Editor
1. In the left sidebar, click on **SQL Editor** (icon looks like `</>`)
2. Click **New Query** button (top right)
3. You should see an empty SQL editor

---

## Step 2: Create Priorities Table

### 2.1 Copy and Execute SQL

**Copy this entire SQL block:**

```sql
-- Create priorities table
CREATE TABLE IF NOT EXISTS priorities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    level INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, level)
);

-- Enable RLS
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own priorities"
    ON priorities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own priorities"
    ON priorities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own priorities"
    ON priorities FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own priorities"
    ON priorities FOR DELETE
    USING (auth.uid() = user_id);
```

### 2.2 Execute the Query
1. Paste the SQL into the editor
2. Click **RUN** button (bottom right) or press `Ctrl+Enter` (Windows/Linux) / `Cmd+Enter` (Mac)
3. Wait for "Success. No rows returned" message

### 2.3 Verify Table Creation
Run this verification query:

```sql
SELECT * FROM priorities LIMIT 5;
```

**Expected result:** Empty table (no rows) with columns: `id`, `user_id`, `name`, `color`, `level`, `created_at`

---

## Step 3: Modify Todos Table

### 3.1 Add priority_id Column

**Copy and execute this SQL:**

```sql
-- Add priority_id column to todos
ALTER TABLE todos
ADD COLUMN priority_id UUID REFERENCES priorities(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_todos_priority_id ON todos(priority_id);
```

### 3.2 Execute the Query
1. Paste the SQL into the editor (you can use the same query window)
2. Click **RUN**
3. Wait for "Success. No rows returned" message

### 3.3 Verify Column Addition
Run this verification query:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'todos' AND column_name = 'priority_id';
```

**Expected result:**
| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| priority_id | uuid      | YES         |

---

## Step 4: Verify RLS Policies

### 4.1 Check RLS Policies

Run this verification query:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'priorities';
```

**Expected result:** 4 rows showing the policies:
- Users can view their own priorities (SELECT)
- Users can insert their own priorities (INSERT)
- Users can update their own priorities (UPDATE)
- Users can delete their own priorities (DELETE)

---

## Step 5: Create Default Priorities (OPTIONAL)

This step creates default priorities (High, Medium, Low) for all existing users.

**⚠️ OPTIONAL:** Skip this if you want users to create their own priorities in the settings page.

### 5.1 Insert Default Priorities

**Copy and execute this SQL:**

```sql
-- Insert default priorities for all existing users
INSERT INTO priorities (user_id, name, color, level)
SELECT DISTINCT user_id, 'High', '#ef4444', 1 FROM todos
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, level) DO NOTHING;

INSERT INTO priorities (user_id, name, color, level)
SELECT DISTINCT user_id, 'Medium', '#f59e0b', 2 FROM todos
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, level) DO NOTHING;

INSERT INTO priorities (user_id, name, color, level)
SELECT DISTINCT user_id, 'Low', '#10b981', 3 FROM todos
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, level) DO NOTHING;
```

### 5.2 Verify Default Priorities

```sql
SELECT user_id, name, color, level
FROM priorities
ORDER BY user_id, level;
```

**Expected result:** 3 rows per user (High, Medium, Low) with appropriate colors

---

## Step 6: Final Verification

### 6.1 Test Complete Setup

Run this comprehensive verification query:

```sql
-- Check table structure
SELECT
    'priorities table' as check_type,
    COUNT(*) as count
FROM priorities
UNION ALL
SELECT
    'todos with priority_id column' as check_type,
    COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'todos' AND column_name = 'priority_id'
UNION ALL
SELECT
    'RLS policies on priorities' as check_type,
    COUNT(*) as count
FROM pg_policies
WHERE tablename = 'priorities';
```

**Expected result:**
| check_type                    | count |
|-------------------------------|-------|
| priorities table              | 0+ *  |
| todos with priority_id column | 1     |
| RLS policies on priorities    | 4     |

\* Depends on whether you ran Step 5 (0 if skipped, 3× number of users if executed)

---

## Step 7: Visual Verification in Supabase UI

### 7.1 Check Table Editor

1. In left sidebar, click **Table Editor**
2. You should see **priorities** in the tables list
3. Click on **priorities** table
4. Verify columns: `id`, `user_id`, `name`, `color`, `level`, `created_at`

### 7.2 Check Todos Table

1. In Table Editor, click **todos** table
2. Scroll right to see the new **priority_id** column
3. All values should be `NULL` (until priorities are assigned)

---

## Troubleshooting

### Error: "relation 'priorities' already exists"
**Solution:** Table already created. Skip to Step 3.

### Error: "column 'priority_id' of relation 'todos' already exists"
**Solution:** Column already added. Skip to Step 4.

### Error: "permission denied for table priorities"
**Solution:** RLS policies may not be set correctly. Re-run Step 2.1 policy creation section.

### Error: "violates foreign key constraint"
**Solution:** Ensure priorities table exists before adding column to todos.

---

## Rollback Instructions

If you need to undo the migration:

### Rollback Step 1: Remove Column from Todos

```sql
ALTER TABLE todos DROP COLUMN priority_id;
```

### Rollback Step 2: Drop Priorities Table

```sql
DROP TABLE IF EXISTS priorities CASCADE;
```

**⚠️ WARNING:** This will permanently delete all priority data.

---

## Next Steps After Migration

1. ✅ Database migration complete
2. 📝 Frontend implementation needed (will be in a future PR)
3. 🎨 UI for priority management (settings page)
4. 🏷️ Priority selector in add todo modal
5. 📊 Visual priority indicators on todos

---

## Summary

After completing this guide, you will have:

✅ Created `priorities` table with proper structure
✅ Added `priority_id` column to `todos` table
✅ Enabled Row Level Security (RLS)
✅ Created 4 RLS policies for user data isolation
✅ Optionally created default priorities
✅ Verified all changes

**Database is now ready for the priority feature frontend implementation!**

---

## Questions or Issues?

If you encounter any problems:
1. Check the **Troubleshooting** section above
2. Verify each step was completed in order
3. Check Supabase logs: Dashboard → Database → Logs
4. Report issues in PR #16: https://github.com/RadekCap/todolist/pull/16
