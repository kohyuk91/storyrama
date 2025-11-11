-- Add thumbnail column to shots table
ALTER TABLE public.shots 
ADD COLUMN IF NOT EXISTS thumbnail TEXT;

