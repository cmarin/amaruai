-- PostgreSQL Migration: Add asset_selection_config to workflow table
-- This migration adds a JSONB column to store individual asset selection configuration

-- Add the new column (using JSONB for better performance and indexing)
ALTER TABLE workflow 
ADD COLUMN asset_selection_config JSONB;

-- Add a comment explaining the column structure
COMMENT ON COLUMN workflow.asset_selection_config IS 
'Configuration for individual asset selection from knowledge bases. 
Structure: {
  knowledge_base_selections: [
    {
      knowledge_base_id: UUID,
      selection_type: "single" | "multiple",
      max_selections: number (for multiple only),
      required: boolean,
      label: string
    }
  ]
}';

-- Optional: Create an index for better query performance if you need to query by configuration
-- CREATE INDEX idx_workflow_asset_selection_config ON workflow USING GIN (asset_selection_config);

-- To rollback this migration:
-- ALTER TABLE workflow DROP COLUMN asset_selection_config;