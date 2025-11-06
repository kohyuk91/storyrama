-- Create scenes table
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (filtering by user_id is done in application code)
CREATE POLICY "Allow all operations for authenticated users" ON public.scenes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index on project_id for faster queries
CREATE INDEX IF NOT EXISTS scenes_project_id_idx ON public.scenes(project_id);

-- Create index on order_index for faster sorting
CREATE INDEX IF NOT EXISTS scenes_order_index_idx ON public.scenes(project_id, order_index);

