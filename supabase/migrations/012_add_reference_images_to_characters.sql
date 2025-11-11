-- Add reference_images column to characters table
ALTER TABLE public.characters 
ADD COLUMN IF NOT EXISTS reference_images JSONB DEFAULT '[]'::jsonb;

