FROM python:3.12-slim as base

# Configure Poetry
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.7.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    VENV_PATH="/app/.venv"

ENV PATH="$POETRY_HOME/bin:$VENV_PATH/bin:$PATH"

FROM base as builder

WORKDIR /app

# Install poetry
RUN pip install "poetry==$POETRY_VERSION"

# Install system dependencies required for psycopg2-binary
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies (corrected command)
RUN poetry install --only main

FROM base as runtime

WORKDIR /app

# Install required system libraries for psycopg2
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /app/.venv ./.venv

# Copy application code
COPY ./app ./app

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]