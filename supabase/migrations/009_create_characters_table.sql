-- Create characters table
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  clothes TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON public.characters
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index on name for faster queries
CREATE INDEX IF NOT EXISTS characters_name_idx ON public.characters(name);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS characters_created_at_idx ON public.characters(created_at DESC);

