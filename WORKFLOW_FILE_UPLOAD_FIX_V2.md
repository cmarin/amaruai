# Workflow File Upload Fix - Revised Solution

## The Real Problem
When users uploaded files for workflows, the files were being uploaded to Supabase storage and processed by Edge functions to extract content, but the asset records weren't being properly linked to the workflow execution. The workflow was receiving file IDs that didn't correspond to queryable asset records in the database.

## The Solution
Created an endpoint that:
1. Finds existing asset records by ID or file path
2. Creates placeholder asset records if they don't exist (content will be populated by Supabase Edge functions)
3. Returns the asset IDs for use in the workflow

## Implementation Details

### Backend Changes (FastAPI)

#### New Endpoint: `/workflows/{workflow_id}/create-assets-from-files`
- **Purpose**: Link uploaded files to asset records for workflow execution
- **Process**:
  1. Validates workflow allows file uploads
  2. For each uploaded file:
     - First tries to find existing asset by ID
     - Then tries to find by file path
     - If not found, creates a placeholder asset record
  3. Returns list of asset IDs

#### Key Features:
- No file downloading (content extraction happens via Supabase Edge functions)
- Creates assets with `managed=false` for temporary workflow files
- Sets initial status to 'processing' for new assets
- Handles both existing and new assets seamlessly

### Frontend Changes (Next.js)

#### Updated Workflow Service
- Added `createAssetsFromFiles` function that calls the new endpoint
- Uses `fetchWithRetry` for resilience
- Returns asset IDs for workflow execution

#### Updated Workflow Page
- Calls `createAssetsFromFiles` when files are uploaded
- Passes returned asset IDs to workflow execution
- Shows toast notifications for partial failures
- Continues workflow even if some files fail

## Data Flow

1. **User uploads files** → Files stored in Supabase storage
2. **Frontend gets file info** → ID, name, URL, type, size
3. **Frontend calls create-assets-from-files** → Sends file info to backend
4. **Backend finds/creates assets** → Returns asset IDs
5. **Supabase Edge function** → Extracts content and updates asset records
6. **Workflow executes** → Uses asset IDs to retrieve content

## Asset Record Structure
```python
Asset(
    id=UUID(file_id),           # Same as uploaded file ID
    title=file_name,             # File name
    file_name=file_name,         # File name
    file_url=relative_path,      # Path in storage
    content="",                  # Populated by Edge function
    file_type=mime_type_prefix,  # e.g., 'text', 'application'
    mime_type=full_mime_type,    # e.g., 'text/plain'
    size=file_size,              # File size in bytes
    uploaded_by=current_user,    # User ID
    managed=False,               # False for temp workflow files
    status='processing',         # Initial status
    token_count=0                # Updated after content extraction
)
```

## Error Handling
- Validates workflow permissions
- Limits to 10 files per upload
- Continues processing if individual files fail
- Returns partial results with appropriate logging
- Database rollback on critical errors

## Logging
- INFO level: Summary of assets found/created
- DEBUG level: Individual file processing details
- WARNING level: Missing assets or failed lookups
- ERROR level: Processing failures with stack traces

## Testing
To test the implementation:
1. Upload files through the workflow UI
2. Check that asset records are created in the database
3. Verify the workflow receives the asset IDs
4. Confirm content is extracted by Edge functions
5. Ensure workflow can access the content

## Key Differences from Initial Solution
- **No content extraction**: Relies on existing Supabase Edge functions
- **No file downloading**: Works with file metadata only
- **Creates placeholder assets**: Records created immediately, content populated async
- **Simpler implementation**: Focuses on linking files to assets, not processing

## Future Considerations
1. Add webhook to update asset status when content extraction completes
2. Implement retry mechanism for assets stuck in 'processing'
3. Add progress tracking for content extraction
4. Consider batch operations for better performance