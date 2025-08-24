# Workflow Execution Wizard Test Plan

## Test Scenario: Wizard Should Not Reappear After Execution

### Setup
1. Have a workflow with `allow_file_upload: true` or `allow_asset_selection: true`
2. Navigate to the workflow execution page

### Test Steps
1. **Initial Load**
   - Wizard should appear automatically if workflow has file upload or asset selection enabled
   - Verify wizard is displayed with correct steps

2. **Complete Wizard**
   - Upload a file or select assets
   - Click through to the final step
   - Click "Execute Workflow" button

3. **Expected Behavior**
   - Wizard should close immediately
   - Workflow should start executing (streaming results appear)
   - **CRITICAL**: Wizard should NOT reappear
   - Wizard should remain closed during entire execution
   - Wizard should remain closed after execution completes

### Key Changes Made
1. Added `isExecuting` check in `checkFirstStep` to prevent wizard from showing during execution
2. Modified the loadWorkflow effect to not trigger during execution
3. Ensured `hasSubmittedWizard` flag persists to prevent re-showing

### Regression Tests
1. Verify "Run Again" button still works properly (resets state and shows wizard again)
2. Verify switching between different workflows resets the wizard state
3. Verify legacy modal approach still works for workflows without wizard requirements