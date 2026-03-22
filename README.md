# AmaruAI

AI-powered workflow automation platform for document processing, transcription, and intelligent data extraction.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

## Overview

AmaruAI is a full-stack platform that combines AI agents, document processing, and workflow automation. It enables users to build configurable workflows that leverage LLMs, OCR, speech-to-text, and vector search to process and extract structured data from documents, audio, and other assets.

Key capabilities:

- **Workflow Builder** — Visual editor for creating multi-step AI workflows with configurable form fields and asset selection
- **Document Processing** — Extract structured data from PDFs and images using OCR (Docling, EasyOCR) and LLMs
- **Audio Transcription** — Transcribe audio/video files using OpenAI Whisper
- **AI Agents** — Orchestrate multi-step reasoning with CrewAI agents
- **Vector Search** — Semantic search over documents using LlamaIndex with Supabase vector store
- **Real-time Streaming** — SSE-based streaming for live workflow execution updates

## Screenshots

![Content Fusion](screenshots/amaruai_screenshot_1.png)
![Workflow Editor](screenshots/amaruai_screenshot_2.png)
![Workflows](screenshots/amaruai_screenshot_3.png)
![Persona Library](screenshots/amaruai_screenshot_4.png)
![Prompt Templates](screenshots/amaruai_screenshot_5.png)
![Chat](screenshots/amaruai_screenshot_6.png)

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI, Supabase Auth, Vercel AI SDK |
| **Backend** | FastAPI, SQLAlchemy 2.0, PostgreSQL, Uvicorn |
| **AI/ML** | CrewAI, LlamaIndex, OpenAI, OpenRouter, Whisper, Docling |
| **Infrastructure** | Supabase (Auth, Storage, Vector DB), Docker |

## Project Structure

```
amaruai/
├── nextjs/          # Frontend — Next.js App Router
│   ├── app/         # Routes and pages
│   ├── components/  # React components
│   ├── hooks/       # Custom React hooks
│   ├── lib/         # Library utilities
│   ├── types/       # TypeScript type definitions
│   └── utils/       # Helper functions
├── fastapi/         # Backend — FastAPI
│   ├── app/         # Application code
│   │   ├── api/v1/  # API route handlers
│   │   ├── config/  # Configuration
│   │   ├── workers/ # Background workers
│   │   ├── main.py  # App entry point
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   └── crud.py
│   ├── alembic/     # Database migrations
│   ├── Dockerfile
│   └── pyproject.toml
├── supabase/        # Supabase local development config
├── docs/            # Documentation
└── LICENSE
```

## Prerequisites

- **Node.js** 18+
- **Python** 3.12+
- **Poetry** (Python dependency manager)
- **Docker** (for local Supabase)
- **Supabase CLI** (`npx supabase`)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/cmarin/amaruai.git
cd amaruai
```

### 2. Install frontend dependencies

```bash
cd nextjs
npm install
```

### 3. Install backend dependencies

```bash
cd fastapi
poetry install
```

### 4. Start local Supabase

The database schema (tables, RLS policies, functions — no data) can be restored from `fastapi/amaruai_schema_backup.sql`:

```bash
psql "YOUR_DATABASE_CONNECTION_STRING" < fastapi/amaruai_schema_backup.sql
```

```bash
cd supabase
npx supabase start
```

This will output your local Supabase URL and anon key — you'll need these for the `.env` files.

### 5. Configure environment variables

Create `nextjs/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_SUPABASE_BUCKET=amaruai-dev
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Create `fastapi/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
ASYNC_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_BUCKET=amaruai-dev
OPENAI_API_KEY=<your-openai-api-key>
ENVIRONMENT=development
```

### 6. Run database migrations

```bash
cd fastapi
poetry run alembic upgrade head
```

### 7. Start the backend

```bash
cd fastapi
poetry run uvicorn app.main:app --reload --port 8000
```

### 8. Start the frontend

```bash
cd nextjs
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Environment Variables

### Frontend (`nextjs/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `NEXT_PUBLIC_SUPABASE_BUCKET` | Supabase storage bucket name | Yes |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL | Yes |
| `NEXT_PUBLIC_APP_URL` | Frontend URL (for auth redirects) | Yes |
| `NEXT_PUBLIC_DEBUG` | Enable debug logging | No |

### Backend (`fastapi/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ASYNC_DATABASE_URL` | Async PostgreSQL connection string | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_BUCKET` | Supabase storage bucket name | Yes |
| `OPENAI_API_KEY` | OpenAI API key (embeddings, chat) | Yes |
| `OPENROUTER_API_KEY` | OpenRouter API key (LLM routing) | No |
| `OPENROUTER_API_BASE` | OpenRouter API base URL | No |
| `WHISPER_API` | Whisper API endpoint | No |
| `WHISPER_MODEL` | Whisper model name (default: `whisper-1`) | No |
| `ENVIRONMENT` | `development` or `production` | No |
| `SERVICE1_API_KEY` | Internal API authentication key | No |

## Development

### Frontend

```bash
cd nextjs
npm run dev       # Start dev server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

### Backend

```bash
cd fastapi
poetry run uvicorn app.main:app --reload --port 8000   # Start dev server
poetry run alembic upgrade head                         # Run migrations
poetry run alembic revision --autogenerate -m "msg"     # Create migration
```

## Deployment

- **Backend** — Deployed on Railway using `fastapi/Dockerfile`. A separate worker service uses `Dockerfile.worker` for background asset processing.
- **Frontend** — Deployed on Vercel with standard Next.js configuration.

Both services connect to a hosted Supabase project for database, auth, and file storage.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
