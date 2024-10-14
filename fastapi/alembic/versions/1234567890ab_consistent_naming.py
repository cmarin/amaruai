"""Consistent naming

Revision ID: 1234567890ab
Revises: add_remaining_tables
Create Date: 2024-03-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1234567890ab'
down_revision = 'add_remaining_tables'
branch_labels = None
depends_on = None

def upgrade():
    # Renaming tables
    op.execute("ALTER TABLE IF EXISTS prompttemplate RENAME TO prompt_template")
    op.execute("ALTER TABLE IF EXISTS chat_models RENAME TO chat_model")

    # Updating association tables to match naming conventions
    op.execute("ALTER TABLE IF EXISTS prompttemplate_category RENAME TO prompt_template_category")
    op.execute("ALTER TABLE IF EXISTS prompttemplate_tag RENAME TO prompt_template_tag")

    # Renaming columns to match updated naming conventions
    op.execute("ALTER TABLE IF EXISTS prompt_template_category RENAME COLUMN IF EXISTS prompttemplate_id TO prompt_template_id")
    op.execute("ALTER TABLE IF EXISTS prompt_template_tag RENAME COLUMN IF EXISTS prompttemplate_id TO prompt_template_id")

def downgrade():
    # Reverting column names to original
    op.execute("ALTER TABLE IF EXISTS prompt_template_tag RENAME COLUMN IF EXISTS prompt_template_id TO prompttemplate_id")
    op.execute("ALTER TABLE IF EXISTS prompt_template_category RENAME COLUMN IF EXISTS prompt_template_id TO prompttemplate_id")

    # Reverting association table names
    op.execute("ALTER TABLE IF EXISTS prompt_template_tag RENAME TO prompttemplate_tag")
    op.execute("ALTER TABLE IF EXISTS prompt_template_category RENAME TO prompttemplate_category")

    # Reverting table names
    op.execute("ALTER TABLE IF EXISTS chat_model RENAME TO chat_models")
    op.execute("ALTER TABLE IF EXISTS prompt_template RENAME TO prompttemplate")
