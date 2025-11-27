# Database Migration for Priority Feature

This document contains the SQL commands needed to add priority functionality to the todolist application.

## Step 1: Create priorities table

Run this SQL in Supabase SQL Editor:

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

## Step 2: Add priority_id column to todos table

```sql
-- Add priority_id column to todos
ALTER TABLE todos
ADD COLUMN priority_id UUID REFERENCES priorities(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_todos_priority_id ON todos(priority_id);
```

## Step 3: Insert default priorities for existing users (optional)

```sql
-- Insert default priorities for all existing users
-- This is optional - users can create their own priorities in the settings page

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

## Verification

After running the migrations, verify:

```sql
-- Check priorities table exists
SELECT * FROM priorities LIMIT 5;

-- Check todos table has priority_id column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'todos' AND column_name = 'priority_id';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'priorities';
```

## Rollback (if needed)

```sql
-- Remove priority_id from todos
ALTER TABLE todos DROP COLUMN priority_id;

-- Drop priorities table
DROP TABLE IF EXISTS priorities CASCADE;
```
