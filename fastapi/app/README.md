AmaruAI is a platform for creating and managing AI agents and workflows.

## Screenshots

![Content Fusion](../../screenshots/amaruai_screenshot_1.png)
![Workflow Editor](../../screenshots/amaruai_screenshot_2.png)
![Workflows](../../screenshots/amaruai_screenshot_3.png)
![Persona Library](../../screenshots/amaruai_screenshot_4.png)
![Prompt Templates](../../screenshots/amaruai_screenshot_5.png)
![Chat](../../screenshots/amaruai_screenshot_6.png)

## Database

The database schema (tables, RLS policies, functions — no data) can be restored from `fastapi/amaruai_schema_backup.sql`:

```bash
psql "YOUR_DATABASE_CONNECTION_STRING" < fastapi/amaruai_schema_backup.sql
```

## Getting Started

1. Clone the repository
2. Install dependencies
3. Run the development server
