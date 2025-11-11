-- Create project_characters junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.project_characters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, character_id)
);

-- Enable Row Level Security
ALTER TABLE public.project_characters ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON public.project_characters
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index on project_id for faster queries
CREATE INDEX IF NOT EXISTS project_characters_project_id_idx ON public.project_characters(project_id);

-- Create index on character_id for faster queries
CREATE INDEX IF NOT EXISTS project_characters_character_id_idx ON public.project_characters(character_id);

