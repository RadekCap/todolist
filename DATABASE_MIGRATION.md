# Database Migrations

Run these SQL statements in the Supabase SQL Editor (Dashboard → SQL Editor).

---

## Fix: Add missing DELETE RLS policies

**Problem:** The `todos` (and `categories`) tables had SELECT/INSERT/UPDATE policies but no DELETE policy. Supabase RLS denies DELETE by default when no policy exists, returning no error but affecting 0 rows — causing silent data loss on the client side.

**Run in Supabase SQL Editor:**

```sql
-- Allow users to delete their own todos
CREATE POLICY "Users can delete their own todos"
ON todos
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own categories
CREATE POLICY "Users can delete their own categories"
ON categories
FOR DELETE
USING (auth.uid() = user_id);
```

**Verify existing policies (optional):**

```sql
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('todos', 'categories')
ORDER BY tablename, cmd;
```

Expected output should include a row for `DELETE` on both tables.
