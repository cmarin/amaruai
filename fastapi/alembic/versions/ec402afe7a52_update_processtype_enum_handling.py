"""Update ProcessType enum handling

Revision ID: ec402afe7a52
Revises: xxxxxxxxxxxx
Create Date: <current_date_and_time>

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ec402afe7a52'
down_revision = 'xxxxxxxxxxxx'  # Replace this with the actual previous revision ID
branch_labels = None
depends_on = None

def upgrade():
    # Check if the enum type already exists
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processtype') THEN CREATE TYPE processtype AS ENUM('SEQUENTIAL', 'PARALLEL'); END IF; END $$;")
    
    # Add the column if it doesn't exist
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow' AND column_name='process_type') THEN ALTER TABLE workflow ADD COLUMN process_type processtype DEFAULT 'SEQUENTIAL'; END IF; END $$;")

    # Update existing values in the workflow table
    op.execute("""
        UPDATE workflow
        SET process_type = CASE
            WHEN process_type::text = 'sequential' THEN 'SEQUENTIAL'::processtype
            WHEN process_type::text = 'parallel' THEN 'PARALLEL'::processtype
            ELSE 'SEQUENTIAL'::processtype
        END
    """)

def downgrade():
    # We don't want to remove the column or change the enum in the downgrade
    # as it might cause data loss. Instead, we'll just log a message.
    op.execute("SELECT 1")  # No-op SQL statement
    print("Manual intervention required to downgrade ProcessType enum")
