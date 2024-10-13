"""Combined ChatModel migration

Revision ID: combined_chatmodel_migration
Revises: 
Create Date: 2024-09-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'combined_chatmodel_migration'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create chatmodel table
    op.create_table('chatmodel',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('api_key', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('default', sa.Boolean(), server_default=sa.text('FALSE'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('chatmodel')
