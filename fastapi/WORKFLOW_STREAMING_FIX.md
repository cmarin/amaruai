# Workflow Streaming Error Fix

## Problem
The workflow streaming was failing with a Pydantic validation error:
```
1 validation error for Task
description
  Input should be a valid string [type=string_type, input_value=None, input_type=NoneType]
```

This error occurred when CrewAI tried to create a Task with a `None` description value.

## Root Cause
The issue was in the `execute_workflow` method in `crewai_service.py`:

1. Some workflow steps didn't have prompt templates (`prompt_template` was `None`)
2. When accessing `prompt_template.prompt` on a `None` object, it would fail
3. The description for the Task would end up as `None`, causing the validation error

## Solution Implemented

### 1. Skip Invalid Steps
Added a check to skip workflow steps that don't have a prompt template:
```python
# Skip steps without a prompt template
if not prompt_template:
    logger.warning(f"Step {i+1} (position {step.position}) has no prompt template - skipping")
    continue
```

### 2. Robust Description Handling
Improved the description building logic with multiple fallbacks:
```python
# Build prompt with RAG content
if i == 0 and "message" in user_input and user_input.get("message"):
    description = user_input.get("message")
elif prompt_template and prompt_template.prompt:
    description = prompt_template.prompt
else:
    # Fallback description if both are None/empty
    description = "Process this step"
    logger.warning(f"Step {i+1} has no description from user input or prompt template, using fallback")
```

### 3. Validate Workflow Has Executable Tasks
Added a check before executing the workflow to ensure there are valid tasks:
```python
# Check if we have any valid tasks to execute
if not tasks:
    logger.error("No valid tasks to execute in workflow")
    self._streams[stream_token]['status'] = 'error'
    self._streams[stream_token]['error'] = 'No valid tasks found in workflow. Please ensure workflow steps have prompt templates.'
    return
```

## Impact
- Workflows with incomplete or invalid steps will now skip those steps instead of failing
- A clear error message is returned if no valid tasks can be created
- The system is more resilient to data inconsistencies
- Proper logging helps diagnose issues with workflow configuration

## Testing Recommendations
1. Review existing workflows to ensure all steps have valid prompt templates
2. Consider adding database constraints to prevent creating workflow steps without prompt templates
3. Update the workflow creation UI to validate that each step has required fields

## Files Modified
- `/root/repo/fastapi/app/config/crewai_service.py`

## Prevention
To prevent this issue in the future:
1. Add validation in the workflow creation/update endpoints to ensure steps have prompt templates
2. Consider making `prompt_template_id` a required field in the WorkflowStep model
3. Add frontend validation to prevent saving workflows with incomplete steps