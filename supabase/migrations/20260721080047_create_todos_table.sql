/*
# Create todos table (multi-user, owner-scoped)

1. New Tables
- `todos`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, not null, defaults to the authenticated user via auth.uid(),
    references auth.users with ON DELETE CASCADE so deleting a user removes their todos)
  - `title` (text, not null) — the todo's text content
  - `completed` (boolean, not null, default false) — whether the todo is done
  - `created_at` (timestamptz, default now()) — when the todo was created
  - `updated_at` (timestamptz, default now()) — when the todo was last modified
2. Indexes
- `todos_user_id_idx` on `user_id` for fast per-user queries
3. Triggers
- `todos_set_updated_at` — BEFORE UPDATE trigger that refreshes `updated_at` to now()
  so "recently edited" ordering stays reliable.
4. Security
- Enable Row Level Security on `todos`.
- Owner-scoped CRUD: each authenticated user can only SELECT, INSERT, UPDATE, and
  DELETE rows where `auth.uid() = user_id`. The `DEFAULT auth.uid()` on `user_id`
  lets the frontend insert `{ title }` without threading the owner through.
5. Important Notes
- Policies are dropped first (DROP POLICY IF EXISTS) so the migration is idempotent
  and safe to re-run after a timeout or partial failure.
- No anon access: this app requires sign-in, so all policies are TO authenticated.
*/

-- updated_at helper function (must exist before trigger is created)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);

DROP TRIGGER IF EXISTS todos_set_updated_at ON todos;
CREATE TRIGGER todos_set_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_todos" ON todos;
CREATE POLICY "select_own_todos" ON todos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_todos" ON todos;
CREATE POLICY "insert_own_todos" ON todos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_todos" ON todos;
CREATE POLICY "update_own_todos" ON todos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_todos" ON todos;
CREATE POLICY "delete_own_todos" ON todos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
