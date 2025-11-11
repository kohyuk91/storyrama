-- Add project_id to characters table (nullable first for migration)
ALTER TABLE public.characters 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Migrate existing data from project_characters to characters
-- This will link existing characters to their projects
UPDATE public.characters c
SET project_id = pc.project_id
FROM public.project_characters pc
WHERE c.id = pc.character_id
AND c.project_id IS NULL;

-- Delete any characters that don't have a project_id (orphaned characters)
-- This handles the case where characters exist but aren't linked to any project
DELETE FROM public.characters WHERE project_id IS NULL;

-- Now make project_id NOT NULL after migration
ALTER TABLE public.characters 
ALTER COLUMN project_id SET NOT NULL;

-- Create index on project_id for faster queries
CREATE INDEX IF NOT EXISTS characters_project_id_idx ON public.characters(project_id);

-- Drop the project_characters junction table
DROP TABLE IF EXISTS public.project_characters;

