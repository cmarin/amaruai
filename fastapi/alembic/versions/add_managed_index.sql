-- SQL migration to add index on managed field for better query performance
-- This index will speed up queries that filter by managed=True (default in /assets endpoint)

-- Create index on managed field
CREATE INDEX IF NOT EXISTS idx_assets_managed ON assets(managed);

-- Create composite index for the common query pattern: filter by managed and sort by created_at
CREATE INDEX IF NOT EXISTS idx_assets_managed_created_at ON assets(managed, created_at DESC);

-- Note: These indexes will improve performance for:
-- 1. GET /assets?managed=true (default query)
-- 2. Sorting by created_at with managed filter
-- 3. Knowledge base asset selection queries