-- Add user_id column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects(user_id);

-- Update RLS policy (Note: Clerk user_id is handled at application level)
-- Keep existing policy for now, filtering is done in application code
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.projects;

-- Allow all operations (filtering by user_id is done in application code)
CREATE POLICY "Allow all operations for authenticated users" ON public.projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

