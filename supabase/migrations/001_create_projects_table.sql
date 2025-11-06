-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL CHECK (aspect_ratio IN ('16:9', '1:1', '9:16')),
  art_style TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
-- You may want to adjust this based on your authentication requirements
CREATE POLICY "Allow all operations for authenticated users" ON public.projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON public.projects(created_at DESC);

