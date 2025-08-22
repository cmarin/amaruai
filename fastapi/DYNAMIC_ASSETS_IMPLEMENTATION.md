# Dynamic Assets Implementation for CrewAI Workflows - FastAPI Backend

## Overview
This document summarizes the FastAPI backend implementation for allowing users to dynamically specify assets, knowledge bases, and upload files for CrewAI workflows at runtime.

## Database Schema Changes (Already Applied)
```sql
ALTER TABLE workflow
ADD COLUMN IF NOT EXISTS allow_file_upload BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allow_asset_selection BOOLEAN DEFAULT FALSE;
```

## Implementation Changes

### 1. Models (app/models.py)
Added two new columns to the Workflow model:
- `allow_file_upload`: Boolean flag to enable/disable file uploads for a workflow
- `allow_asset_selection`: Boolean flag to enable/disable asset and knowledge base selection

```python
allow_file_upload = Column(Boolean, default=False, nullable=False)
allow_asset_selection = Column(Boolean, default=False, nullable=False)
```

### 2. Pydantic Schemas (app/schemas.py)

#### Updated WorkflowBase
```python
allow_file_upload: Optional[bool] = False
allow_asset_selection: Optional[bool] = False
```

#### Updated WorkflowCreate
```python
allow_file_upload: Optional[bool] = False
allow_asset_selection: Optional[bool] = False
```

#### Enhanced WorkflowExecuteInput
```python
class WorkflowExecuteInput(BaseModel):
    message: Optional[str] = None
    file_ids: Optional[List[UUID]] = []  # Uploaded file asset IDs
    asset_ids: Optional[List[UUID]] = []  # Selected asset IDs
    knowledge_base_ids: Optional[List[UUID]] = []  # Selected KB IDs
```

### 3. CrewAI Service (app/config/crewai_service.py)

Modified `execute_workflow` method to:
1. Extract dynamic inputs from user_input
2. Merge dynamic assets with workflow's fixed assets
3. Remove duplicates
4. Use merged lists for RAG content generation

Key changes:
```python
# Extract dynamic inputs
dynamic_file_ids = user_input.get("file_ids", [])
dynamic_asset_ids = user_input.get("asset_ids", [])
dynamic_kb_ids = user_input.get("knowledge_base_ids", [])

# Merge with existing workflow assets
all_asset_ids = [asset.id for asset in workflow.assets] if workflow.assets else []
all_kb_ids = [kb.id for kb in workflow.knowledge_bases] if workflow.knowledge_bases else []

# Add dynamic selections and remove duplicates
all_asset_ids = list(set(all_asset_ids + dynamic_file_ids + dynamic_asset_ids))
all_kb_ids = list(set(all_kb_ids + dynamic_kb_ids))
```

### 4. Workflow Endpoints (app/api/v1/workflows.py)

#### Updated Stream Endpoint
- Changed to accept `WorkflowExecuteInput` instead of `Dict[str, str]`
- Added validation for dynamic inputs based on workflow settings
- Returns 400 error if inputs are provided but not allowed

```python
@router.post("/{workflow_id}/stream")
async def initiate_workflow_stream(
    workflow_id: UUID,
    user_input: WorkflowExecuteInput,  # Enhanced input model
    ...
):
    # Validate dynamic inputs are allowed
    if not workflow.allow_file_upload and user_input.file_ids:
        raise HTTPException(status_code=400, detail="This workflow does not allow file uploads")
    if not workflow.allow_asset_selection and (user_input.asset_ids or user_input.knowledge_base_ids):
        raise HTTPException(status_code=400, detail="This workflow does not allow asset/KB selection")
```

#### New Helper Endpoints

1. **Upload Assets Validation** (`POST /{workflow_id}/upload-assets`)
   - Validates that workflow allows file uploads
   - Verifies assets exist and belong to user
   - Returns validated asset IDs for use in execution

2. **Get Upload Configuration** (`GET /{workflow_id}/upload-config`)
   - Returns workflow's upload/selection permissions
   - Lists existing fixed assets and knowledge bases
   - Used by frontend to determine what UI elements to show

### 5. CRUD Operations (app/crud.py)
No changes needed - existing CRUD operations automatically handle new fields through the updated schemas.

## API Usage Examples

### 1. Create Workflow with Dynamic Input Enabled
```python
POST /api/v1/workflows
{
    "name": "Dynamic Content Workflow",
    "description": "Process user-uploaded files",
    "process_type": "SEQUENTIAL",
    "allow_file_upload": true,
    "allow_asset_selection": true,
    "steps": [...]
}
```

### 2. Check Workflow Configuration
```python
GET /api/v1/workflows/{workflow_id}/upload-config

Response:
{
    "workflow_id": "...",
    "allow_file_upload": true,
    "allow_asset_selection": true,
    "existing_assets": [...],
    "existing_knowledge_bases": [...]
}
```

### 3. Execute Workflow with Dynamic Assets
```python
POST /api/v1/workflows/{workflow_id}/stream
{
    "message": "Process these documents",
    "file_ids": ["uuid1", "uuid2"],  // Uploaded file IDs
    "asset_ids": ["uuid3"],           // Selected asset IDs
    "knowledge_base_ids": ["uuid4"]   // Selected KB IDs
}
```

## Frontend Integration Requirements

The NextJS frontend should:

1. **Workflow Configuration UI**
   - Add checkboxes for `allow_file_upload` and `allow_asset_selection` in workflow creation/edit forms
   - Save these settings when creating/updating workflows

2. **Dynamic Workflow Execution UI**
   - Call `/upload-config` endpoint to check what's allowed
   - If `allow_file_upload` is true:
     - Show file upload interface
     - Upload files to create assets (existing flow)
     - Collect asset IDs
   - If `allow_asset_selection` is true:
     - Show asset/KB selection interface
     - Allow users to select from existing assets/KBs
   - Pass collected IDs in the workflow execution request

3. **Similar to Complex Prompts**
   - The UI flow should be similar to how complex prompts are handled
   - Show dynamic input collection before workflow execution
   - Pass all collected data to the stream endpoint

## Testing Checklist

- [x] Python syntax validation passed
- [x] Models include new columns
- [x] Schemas include new fields
- [x] CrewAI service merges dynamic assets correctly
- [x] Stream endpoint validates permissions
- [x] Helper endpoints created
- [ ] Integration testing with frontend
- [ ] End-to-end workflow execution with dynamic assets

## Notes

- File uploads are treated as assets (they create asset records)
- Dynamic inputs are merged with fixed workflow assets/KBs
- Duplicates are automatically removed
- Validation ensures users can't bypass workflow restrictions
- The implementation is backward compatible - existing workflows continue to work unchanged