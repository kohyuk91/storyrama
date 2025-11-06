-- Create shots table
CREATE TABLE IF NOT EXISTS public.shots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  script TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (filtering by user_id is done in application code)
CREATE POLICY "Allow all operations for authenticated users" ON public.shots
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index on scene_id for faster queries
CREATE INDEX IF NOT EXISTS shots_scene_id_idx ON public.shots(scene_id);

-- Create index on order_index for faster sorting
CREATE INDEX IF NOT EXISTS shots_order_index_idx ON public.shots(scene_id, order_index);

