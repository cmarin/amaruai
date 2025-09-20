# Form Builder System - Technical Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [JSON Structure](#json-structure)
4. [Form Field Types](#form-field-types)
5. [Runtime Form Building Process](#runtime-form-building-process)
6. [File Architecture](#file-architecture)
7. [Implementation Guide](#implementation-guide)
8. [API Integration](#api-integration)
9. [Workflow Integration](#workflow-integration)
10. [Examples](#examples)

## Overview

The Form Builder System is a sophisticated dynamic form generation framework that enables the creation of complex, variable-driven prompt templates. It allows users to define forms with various field types, validation rules, and dynamic content generation capabilities. The system is primarily used for creating "complex prompts" - templates that contain variables that end users fill out to generate customized prompts for AI interactions.

### Key Features
- Dynamic form generation from JSON configuration
- 6 different field types with specific validation options
- Real-time prompt preview with variable substitution
- Integration with workflow execution system
- Support for required/optional fields
- Default values and preselected options
- Custom validation rules per field type
- Tooltips and helper text support

### Design Principles
- **Declarative Configuration**: Forms are defined as JSON structures, making them portable and version-controllable
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Component Reusability**: Modular components that can be used in different contexts
- **Real-time Feedback**: Users see generated prompts update as they fill out forms
- **Validation First**: Built-in validation ensures data integrity before submission

## Architecture

The form builder system follows a layered architecture:

```
┌─────────────────────────────────────┐
│         UI Layer (React)            │
│  - ComplexPromptEditor              │
│  - ComplexPromptModal               │
│  - ComplexPromptStep                │
└─────────────────────────────────────┘
                 │
┌─────────────────────────────────────┐
│      Service Layer (TypeScript)     │
│  - prompt-template-service.ts       │
│  - workflow-service.ts              │
└─────────────────────────────────────┘
                 │
┌─────────────────────────────────────┐
│        Storage Layer (JSON)         │
│  - Database (Supabase)              │
│  - Cached API responses             │
└─────────────────────────────────────┘
```

### Data Flow
1. **Creation**: User creates form structure using `ComplexPromptEditor`
2. **Storage**: Form configuration saved as JSON via `prompt-template-service`
3. **Retrieval**: Forms loaded from API/cache when needed
4. **Rendering**: `ComplexPromptModal` or `ComplexPromptStep` render forms dynamically
5. **Processing**: User input validated and substituted into prompt template
6. **Output**: Generated prompt sent to AI or workflow system

## JSON Structure

### PromptContent Schema

The core data structure for complex prompts:

```typescript
type PromptContent = {
  variables: Variable[]
  prompt: string
}
```

### Variable Schema

Each variable in the form has the following structure:

```typescript
type Variable = {
  fieldName: string           // Unique identifier for the field
  required: boolean          // Whether the field is mandatory
  controlType: string        // Type of input control
  placeholder?: string       // Placeholder text for input
  options?: string[]         // Options for dropdown/multiselect
  preselectedOption?: string | string[]  // Default selection
  tooltip?: string          // Help text shown on hover
  defaultValue?: number | string  // Default value for input
  validation?: {            // Type-specific validation rules
    // For number type:
    min?: number
    max?: number
    step?: number
    errorMessage?: string
    // For date type:
    min?: string  // ISO date string
    max?: string  // ISO date string
    errorMessage?: string
  }
}
```

### Complete Example

```json
{
  "variables": [
    {
      "fieldName": "ProductName",
      "required": true,
      "controlType": "text",
      "placeholder": "Enter product name",
      "tooltip": "The name of the product you're describing"
    },
    {
      "fieldName": "TargetAudience",
      "required": true,
      "controlType": "dropdown",
      "options": ["B2B", "B2C", "Enterprise", "SMB"],
      "preselectedOption": "B2B",
      "placeholder": "Select target audience"
    },
    {
      "fieldName": "Features",
      "required": false,
      "controlType": "multiselect",
      "options": ["AI-Powered", "Cloud-Based", "Mobile-Friendly", "Analytics", "Integration"],
      "preselectedOption": ["AI-Powered", "Cloud-Based"]
    },
    {
      "fieldName": "Description",
      "required": true,
      "controlType": "textarea",
      "placeholder": "Detailed product description"
    },
    {
      "fieldName": "LaunchDate",
      "required": false,
      "controlType": "date",
      "validation": {
        "min": "2024-01-01",
        "max": "2025-12-31",
        "errorMessage": "Launch date must be within 2024-2025"
      }
    },
    {
      "fieldName": "Price",
      "required": true,
      "controlType": "number",
      "defaultValue": 99,
      "validation": {
        "min": 0,
        "max": 10000,
        "step": 0.01,
        "errorMessage": "Price must be between 0 and 10000"
      }
    }
  ],
  "prompt": "Create a marketing copy for {ProductName}, targeting {TargetAudience} customers. The product features: {Features}. Product description: {Description}. Launch date: {LaunchDate}. Price point: ${Price}"
}
```

## Form Field Types

### 1. Text Field
- **Control Type**: `"text"`
- **Use Case**: Single-line text input
- **Features**:
  - Placeholder text support
  - Required/optional validation
  - Tooltip support
- **Rendered As**: `<Input type="text" />`

### 2. Textarea Field
- **Control Type**: `"textarea"`
- **Use Case**: Multi-line text input
- **Features**:
  - Placeholder text support
  - Adjustable rows (default: 4)
  - Required/optional validation
- **Rendered As**: `<Textarea />`

### 3. Dropdown Field
- **Control Type**: `"dropdown"` or `"select"`
- **Use Case**: Single selection from predefined options
- **Features**:
  - Options array required
  - Preselected option support
  - Placeholder when no selection
- **Rendered As**: `<Select />` component with `<SelectItem />` options
- **Required Properties**: `options: string[]`

### 4. Multiselect Field
- **Control Type**: `"multiselect"`
- **Use Case**: Multiple selections from predefined options
- **Features**:
  - Checkbox list presentation
  - Preselected options support (array)
  - Scrollable container for long lists
- **Rendered As**: List of `<Checkbox />` components
- **Required Properties**: `options: string[]`
- **Output**: Comma-separated string of selected values

### 5. Number Field
- **Control Type**: `"number"`
- **Use Case**: Numeric input with validation
- **Features**:
  - Min/max value constraints
  - Step increment support
  - Default value support
  - Custom error messages
- **Rendered As**: `<Input type="number" />`
- **Validation Properties**:
  ```typescript
  {
    min?: number
    max?: number
    step?: number
    errorMessage?: string
  }
  ```

### 6. Date Field
- **Control Type**: `"date"`
- **Use Case**: Date selection
- **Features**:
  - Min/max date constraints
  - Default date support
  - Browser-native date picker
- **Rendered As**: `<Input type="date" />`
- **Validation Properties**:
  ```typescript
  {
    min?: string  // ISO date format
    max?: string  // ISO date format
    errorMessage?: string
  }
  ```

## Runtime Form Building Process

### 1. Form Initialization
```typescript
// When a complex prompt is loaded:
1. Parse JSON string to PromptContent object
2. Extract variables array
3. Initialize form state with default/preselected values
4. Set up validation rules per field
```

### 2. Dynamic Rendering Process
The system follows this flow for rendering forms:

```typescript
// In ComplexPromptStep.tsx or ComplexPromptModal.tsx

const renderField = (variable: Variable) => {
  // 1. Get current value from state
  const value = values[variable.fieldName] || '';

  // 2. Check validation status
  const hasError = touched[variable.fieldName] &&
                   variable.required &&
                   !value;

  // 3. Render appropriate control based on controlType
  switch(variable.controlType) {
    case 'text': return <Input ... />
    case 'textarea': return <Textarea ... />
    case 'dropdown': return <Select ... />
    case 'multiselect': return <CheckboxList ... />
    case 'number': return <Input type="number" ... />
    case 'date': return <Input type="date" ... />
  }

  // 4. Apply validation attributes
  // 5. Attach event handlers
  // 6. Display error messages if needed
}
```

### 3. Variable Substitution
The prompt generation process:

```typescript
function generatePrompt(content: PromptContent, values: Record<string, any>) {
  let generated = content.prompt;

  content.variables.forEach(variable => {
    const value = values[variable.fieldName];

    if (value !== undefined && value !== '') {
      // Convert arrays to comma-separated strings
      const stringValue = Array.isArray(value)
        ? value.join(', ')
        : String(value);

      // Replace all occurrences of {fieldName}
      generated = generated.replace(
        new RegExp(`\\{${variable.fieldName}\\}`, 'g'),
        stringValue
      );
    } else {
      // Remove placeholder for empty values
      generated = generated.replace(
        new RegExp(`\\{${variable.fieldName}\\}`, 'g'),
        ''
      );
    }
  });

  // Clean up extra whitespace
  return generated.replace(/\s+/g, ' ').trim();
}
```

### 4. Validation Flow
```typescript
1. Field-level validation on change/blur
2. Check required fields
3. Apply type-specific validation (min/max, etc.)
4. Display validation errors
5. Prevent submission if errors exist
6. Show custom error messages or defaults
```

## File Architecture

### Core Components

#### `/nextjs/components/complex-prompt-editor.tsx`
**Purpose**: Main editor component for creating and editing complex prompt templates
- **Lines**: ~600
- **Key Features**:
  - Visual and JSON editing modes
  - Variable management (add, edit, reorder, delete)
  - Real-time prompt preview
  - Step-by-step wizard interface
  - Integration with personas and chat models
- **Exports**: `ComplexPromptEditor` component, `PromptContent` type

#### `/nextjs/components/complex-prompt-modal.tsx`
**Purpose**: Modal dialog for runtime form rendering and prompt generation
- **Lines**: ~300
- **Key Features**:
  - Dynamic form rendering from JSON
  - Real-time variable substitution
  - Dark mode support
  - Form submission handling
- **Usage**: Used in prompt library for executing complex prompts

#### `/nextjs/components/complex-prompt-template-editor.tsx`
**Purpose**: Wrapper component for template management
- **Lines**: ~100
- **Key Features**:
  - Handles save/update operations
  - Category and tag management
  - Integration with API service
  - Toast notifications for feedback

#### `/nextjs/components/form-builder/variable-button-bar.tsx`
**Purpose**: UI component for adding new form fields
- **Lines**: ~41
- **Key Features**:
  - Button bar with icons for each field type
  - Responsive design (hides labels on small screens)
  - Accessibility support (screen reader labels)
- **Exports**: `VariableButtonBar` component, `VariableType` type

#### `/nextjs/components/form-builder/button-bar.tsx`
**Purpose**: Additional UI controls for form builder
- **Key Features**:
  - Supplementary actions and controls
  - Consistent styling with variable button bar

### Workflow Integration Components

#### `/nextjs/components/workflow-execution-wizard/complex-prompt-step.tsx`
**Purpose**: Wizard step for complex prompts in workflow execution
- **Lines**: ~400
- **Key Features**:
  - Split-pane interface (form + preview)
  - Real-time validation
  - Integration with wizard state management
  - Error handling and display
  - Scrollable form area for many fields

### Service Layer

#### `/nextjs/utils/prompt-template-service.ts`
**Purpose**: API service for CRUD operations on prompt templates
- **Key Features**:
  - Type definitions for all prompt-related types
  - CRUD operations (create, read, update, delete)
  - Favorite management
  - Filtering and sorting support
  - Cache management
- **Key Types**:
  - `PromptTemplate`
  - `VariableType`
  - `CreatePromptTemplateRequest`
  - `UpdatePromptTemplateRequest`
  - `PromptTemplateFilters`

#### `/nextjs/utils/prompt-data.ts`
**Purpose**: Type definitions and mock data
- **Key Features**:
  - Type definitions for simple and complex prompts
  - Sample data for development/testing
- **Key Types**:
  - `SimplePrompt`
  - `ComplexPrompt`
  - `Prompt` (union type)

### Page Components

#### `/nextjs/app/(dashboard)/prompt-templates/page.tsx`
**Purpose**: Main listing page for prompt templates
- **Key Features**:
  - Grid/list view of templates
  - Search and filtering
  - Category selection
  - Favorite toggling
  - Create new template dialogs

#### `/nextjs/app/(dashboard)/prompt-templates/new/page.tsx`
**Purpose**: Page for creating new prompt templates
- **Key Features**:
  - Route-based type selection (simple vs complex)
  - Full-page editor experience
  - Category fetching on load

#### `/nextjs/app/(dashboard)/prompt-templates/[id]/page.tsx`
**Purpose**: Page for editing existing prompt templates
- **Key Features**:
  - Dynamic routing with template ID
  - Load existing template data
  - Switch between simple and complex editors

## Implementation Guide

### Creating a New Complex Prompt Template

1. **Navigate to Template Creation**
```typescript
router.push('/prompt-templates/new?type=complex');
```

2. **Configure Variables**
```typescript
// In ComplexPromptEditor, add variables:
const handleAddVariable = (type: VariableType) => {
  setPromptContent(prev => ({
    ...prev,
    variables: [...prev.variables, {
      fieldName: "",
      required: false,
      controlType: type
    }]
  }))
}
```

3. **Set Variable Properties**
- Field name (unique identifier)
- Required/optional status
- Control type selection
- Type-specific properties (options, validation, etc.)

4. **Write Prompt Template**
```typescript
// Use {fieldName} placeholders in prompt:
"Generate a {Tone} article about {Topic} for {Audience}"
```

5. **Save Template**
```typescript
await createPromptTemplate({
  title: "Article Generator",
  prompt: JSON.stringify(promptContent),
  is_complex: true,
  category_ids: [selectedCategory],
  tags: selectedTags,
  default_persona_id: personaId,
  default_chat_model_id: modelId
}, headers);
```

### Rendering a Form at Runtime

1. **Load Template**
```typescript
const template = await fetchPromptTemplate(templateId, headers);
```

2. **Parse JSON Content**
```typescript
const content = typeof template.prompt === 'string'
  ? JSON.parse(template.prompt)
  : template.prompt;
```

3. **Initialize Form State**
```typescript
const initialValues = {};
content.variables.forEach(variable => {
  if (variable.preselectedOption) {
    initialValues[variable.fieldName] = variable.preselectedOption;
  }
});
```

4. **Render Form Fields**
```typescript
{content.variables.map(variable => renderField(variable))}
```

5. **Generate Final Prompt**
```typescript
const finalPrompt = generatePrompt(content, formValues);
```

## API Integration

### Endpoints

#### Create Prompt Template
```
POST /api/prompt_templates
Body: CreatePromptTemplateRequest
Response: PromptTemplate
```

#### Update Prompt Template
```
PUT /api/prompt_templates/:id
Body: UpdatePromptTemplateRequest
Response: PromptTemplate
```

#### Get Prompt Templates
```
GET /api/prompt_templates
Query: PromptTemplateFilters
Response: PromptTemplate[]
```

#### Delete Prompt Template
```
DELETE /api/prompt_templates/:id
Response: 204 No Content
```

### Caching Strategy

The system uses `cachedRequest` from `api-request-manager.ts`:

1. **Cache Key Generation**: Based on endpoint and filters
2. **Cache Duration**: 15 minutes default
3. **Cache Invalidation**: On create/update/delete operations
4. **Pattern Matching**: Invalidate related caches using regex

```typescript
// Cache invalidation example:
invalidateCache(/^prompt_templates/); // Invalidate all prompt template caches
```

## Workflow Integration

### Workflow Execution Flow

1. **Workflow Configuration**
- Workflows can reference prompt templates
- Templates provide default personas and models
- Asset selection configuration supported

2. **Execution Wizard**
```typescript
// In workflow execution wizard:
if (promptTemplate.is_complex) {
  return <ComplexPromptStep
    promptTemplate={promptTemplate}
    onStateChange={updateWizardState}
    onNext={handleNext}
  />
}
```

3. **State Management**
```typescript
// Wizard state includes:
{
  complexPromptData: string, // Generated prompt
  selectedAssets: Asset[],
  selectedPersona: Persona,
  selectedModel: ChatModel
}
```

4. **Batch Processing**
- Complex prompts can be used in batch flows
- Each asset receives the generated prompt
- Variables filled once, applied to all assets

## Examples

### Example 1: Blog Post Generator

```json
{
  "variables": [
    {
      "fieldName": "Topic",
      "required": true,
      "controlType": "text",
      "placeholder": "e.g., Artificial Intelligence in Healthcare"
    },
    {
      "fieldName": "WordCount",
      "required": true,
      "controlType": "number",
      "defaultValue": 1000,
      "validation": {
        "min": 100,
        "max": 5000,
        "step": 100
      }
    },
    {
      "fieldName": "Tone",
      "required": true,
      "controlType": "dropdown",
      "options": ["Professional", "Casual", "Academic", "Conversational"],
      "preselectedOption": "Professional"
    },
    {
      "fieldName": "IncludeSections",
      "required": false,
      "controlType": "multiselect",
      "options": ["Introduction", "Background", "Main Points", "Case Studies", "Conclusion", "Call to Action"],
      "preselectedOption": ["Introduction", "Main Points", "Conclusion"]
    }
  ],
  "prompt": "Write a {WordCount}-word {Tone} blog post about {Topic}. Include the following sections: {IncludeSections}. Make it engaging and informative."
}
```

### Example 2: Product Description Generator

```json
{
  "variables": [
    {
      "fieldName": "ProductName",
      "required": true,
      "controlType": "text"
    },
    {
      "fieldName": "KeyFeatures",
      "required": true,
      "controlType": "textarea",
      "placeholder": "List main features, one per line"
    },
    {
      "fieldName": "TargetMarket",
      "required": true,
      "controlType": "dropdown",
      "options": ["B2B Enterprise", "B2B SMB", "B2C Premium", "B2C Budget", "B2G"],
      "preselectedOption": "B2B Enterprise"
    },
    {
      "fieldName": "LaunchQuarter",
      "required": false,
      "controlType": "dropdown",
      "options": ["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"]
    }
  ],
  "prompt": "Create a compelling product description for {ProductName} targeting the {TargetMarket} market. Key features: {KeyFeatures}. Launch timeline: {LaunchQuarter}."
}
```

### Example 3: Event Invitation

```json
{
  "variables": [
    {
      "fieldName": "EventName",
      "required": true,
      "controlType": "text"
    },
    {
      "fieldName": "EventDate",
      "required": true,
      "controlType": "date",
      "validation": {
        "min": "2024-01-01",
        "max": "2025-12-31"
      }
    },
    {
      "fieldName": "EventType",
      "required": true,
      "controlType": "dropdown",
      "options": ["Conference", "Workshop", "Webinar", "Networking", "Training"],
      "preselectedOption": "Conference"
    },
    {
      "fieldName": "Duration",
      "required": true,
      "controlType": "number",
      "defaultValue": 60,
      "validation": {
        "min": 15,
        "max": 480,
        "step": 15,
        "errorMessage": "Duration must be between 15 and 480 minutes"
      }
    },
    {
      "fieldName": "SpecialRequirements",
      "required": false,
      "controlType": "multiselect",
      "options": ["Parking", "Catering", "WiFi", "Recording", "Live Streaming"]
    }
  ],
  "prompt": "Draft a professional invitation for {EventName}, a {Duration}-minute {EventType} on {EventDate}. Special arrangements: {SpecialRequirements}"
}
```

## Best Practices

### 1. Field Naming
- Use PascalCase for field names (e.g., `ProductName`, not `product_name`)
- Make field names descriptive and unique within a template
- Avoid special characters except underscores

### 2. Validation
- Always add validation for number and date fields
- Provide meaningful error messages
- Use reasonable min/max constraints

### 3. User Experience
- Mark truly required fields as required
- Provide helpful placeholders
- Use tooltips for complex fields
- Order fields logically

### 4. Prompt Template Design
- Use clear variable placeholders: `{FieldName}`
- Handle optional fields gracefully
- Test with various input combinations
- Keep prompts concise but comprehensive

### 5. Performance
- Limit number of variables per template (recommended: <20)
- Use multiselect sparingly for long option lists
- Consider pagination for template libraries

## Troubleshooting

### Common Issues

1. **Variable not substituting**
   - Check field name matches exactly (case-sensitive)
   - Verify value is not empty/undefined
   - Ensure proper JSON structure

2. **Validation not working**
   - Confirm validation object structure
   - Check data types (numbers vs strings)
   - Verify min/max values are logical

3. **Form not rendering**
   - Validate JSON syntax
   - Check `is_complex` flag is true
   - Ensure variables array exists

4. **Options not showing in dropdown**
   - Verify options array is provided
   - Check for empty strings in options
   - Ensure unique option values

## Future Enhancements

Potential improvements to the form builder system:

1. **Advanced Field Types**
   - File upload
   - Rich text editor
   - Color picker
   - Slider/range input

2. **Conditional Logic**
   - Show/hide fields based on other values
   - Dynamic validation rules
   - Dependent dropdowns

3. **Enhanced Validation**
   - Regex patterns for text fields
   - Custom validation functions
   - Cross-field validation

4. **UI/UX Improvements**
   - Drag-and-drop field reordering
   - Field templates/presets
   - Bulk field operations
   - Undo/redo functionality

5. **Integration Features**
   - Webhook support
   - External data sources for options
   - API field population
   - Real-time collaboration

---

*This documentation represents the current state of the Form Builder System. For updates and contributions, please refer to the repository's contribution guidelines.*