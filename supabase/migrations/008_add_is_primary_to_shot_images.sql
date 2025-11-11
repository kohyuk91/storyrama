-- Add is_primary column to shot_images table to mark representative image
ALTER TABLE public.shot_images 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

-- Create index on is_primary for faster queries
CREATE INDEX IF NOT EXISTS shot_images_is_primary_idx ON public.shot_images(shot_id, is_primary) WHERE is_primary = TRUE;

