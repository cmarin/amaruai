# Workflow File Upload Content Fix

## Problem
When users uploaded files to workflows with `allow_file_upload` enabled, the file content was not being passed to the CrewAI agents. The system was only passing file IDs without creating corresponding asset records with extracted content.

## Root Cause
1. Uploaded files were stored in Supabase storage but were not being converted to asset records in the database
2. The workflow execution was trying to retrieve content using file IDs that didn't correspond to actual asset records
3. The `managed` flag was incorrectly set to `true` for temporary workflow files

## Solution

### Backend Changes (FastAPI)

1. **New Endpoint** (`/workflows/{workflow_id}/create-assets-from-files`):
   - Created in `/fastapi/app/api/v1/workflows.py`
   - Takes uploaded file information (URL, name, type, size)
   - Downloads file content from storage
   - Extracts text content based on file type
   - Creates asset records in the database with the content
   - Sets `managed = False` for temporary workflow files
   - Returns created asset IDs

2. **Enhanced Logging** in `/fastapi/app/config/rag_utils.py`:
   - Added detailed logging to track asset retrieval
   - Shows which assets are found and their content status
   - Helps debug content retrieval issues

### Frontend Changes (Next.js)

1. **Updated Workflow Service** (`/nextjs/utils/workflow-service.ts`):
   - Added `createAssetsFromFiles` function to call the new endpoint
   - Converts uploaded files to assets before workflow execution

2. **Updated Workflow Page** (`/nextjs/app/(dashboard)/workflow/[workflowId]/page.tsx`):
   - Modified `handleDynamicInputSubmit` to create assets from uploaded files
   - Calls `createAssetsFromFiles` before initiating workflow
   - Uses the returned asset IDs in the workflow execution

## Technical Details

### Asset Creation Flow
1. User uploads files via the workflow UI
2. Files are stored in Supabase storage
3. Frontend calls `createAssetsFromFiles` with file information
4. Backend downloads files and extracts content
5. Asset records are created with extracted content
6. Asset IDs are returned to frontend
7. Frontend uses asset IDs in workflow execution
8. CrewAI agents can access the file content

### File Type Support
- **Text files** (text/*, application/json, application/xml): Full content extraction
- **PDF files**: Placeholder for now (can be enhanced with PyPDF2)
- **Binary files**: Metadata only (file name, type, size)

### Error Handling
- Graceful handling of download failures
- Continues processing other files if one fails
- Detailed error logging for debugging
- Appropriate HTTP status codes and error messages

## Testing
A test script has been created at `/test_workflow_file_upload.py` to verify:
1. Asset creation from uploaded files
2. Workflow execution with file content

## Migration Notes
No database schema changes required. The solution uses existing Asset model structure.

## Future Enhancements
1. Add PDF content extraction using PyPDF2 or similar library
2. Support for more file types (Word documents, Excel sheets)
3. Implement chunking for very large files
4. Add progress tracking for file processing
5. Implement caching to avoid re-downloading files