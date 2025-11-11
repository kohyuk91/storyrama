-- Create shot_images table to store multiple generated images per shot
CREATE TABLE IF NOT EXISTS public.shot_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shot_id UUID NOT NULL REFERENCES public.shots(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.shot_images ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON public.shot_images
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index on shot_id for faster queries
CREATE INDEX IF NOT EXISTS shot_images_shot_id_idx ON public.shot_images(shot_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS shot_images_created_at_idx ON public.shot_images(shot_id, created_at DESC);

