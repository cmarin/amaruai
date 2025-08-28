"""Add indexes for managed field on assets table

Revision ID: 001_add_managed_indexes
Revises: 
Create Date: 2025-08-28 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_add_managed_indexes'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Add indexes for improved query performance on managed field"""
    # Create index on managed field for filtering
    op.create_index(
        'idx_assets_managed',
        'assets',
        ['managed'],
        if_not_exists=True
    )
    
    # Create composite index for common query pattern: filter by managed and sort by created_at
    op.create_index(
        'idx_assets_managed_created_at',
        'assets',
        ['managed', sa.text('created_at DESC')],
        if_not_exists=True
    )


def downgrade():
    """Remove the managed field indexes"""
    op.drop_index('idx_assets_managed_created_at', table_name='assets')
    op.drop_index('idx_assets_managed', table_name='assets')