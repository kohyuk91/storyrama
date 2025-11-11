-- Add node_graph column to shots table to store React Flow nodes and edges
ALTER TABLE public.shots 
ADD COLUMN IF NOT EXISTS node_graph JSONB DEFAULT '{"nodes": [], "edges": []}'::jsonb;

