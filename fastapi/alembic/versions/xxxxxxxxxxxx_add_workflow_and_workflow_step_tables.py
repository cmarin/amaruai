"""add workflow and workflow step tables

Revision ID: xxxxxxxxxxxx
Revises: e17a9d440ea9
Create Date: 2023-04-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text, Enum
import enum

# revision identifiers, used by Alembic.
revision = 'xxxxxxxxxxxx'
down_revision = 'e17a9d440ea9'
branch_labels = None
depends_on = None

class ProcessType(enum.Enum):
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"

def upgrade():
    # Create ProcessType enum
    process_type_enum = postgresql.ENUM(ProcessType, name='processtype', create_type=False)
    process_type_enum.create(op.get_bind(), checkfirst=True)

    # Create workflow table
    op.create_table('workflow',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('process_type', process_type_enum, nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflow_id'), 'workflow', ['id'], unique=False)
    op.create_index(op.f('ix_workflow_name'), 'workflow', ['name'], unique=False)

    # Create workflow_step table
    op.create_table('workflow_step',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workflow_id', sa.Integer(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('prompt_template_id', sa.Integer(), nullable=True),
        sa.Column('chat_model_id', sa.Integer(), nullable=True),
        sa.Column('persona_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['chat_model_id'], ['chat_model.id'], ),
        sa.ForeignKeyConstraint(['persona_id'], ['persona.id'], ),
        sa.ForeignKeyConstraint(['prompt_template_id'], ['prompt_template.id'], ),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflow.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflow_step_id'), 'workflow_step', ['id'], unique=False)

def downgrade():
    # Drop workflow_step table
    op.drop_index(op.f('ix_workflow_step_id'), table_name='workflow_step')
    op.drop_table('workflow_step')

    # Drop workflow table
    op.drop_index(op.f('ix_workflow_name'), table_name='workflow')
    op.drop_index(op.f('ix_workflow_id'), table_name='workflow')
    op.drop_table('workflow')

    # Drop ProcessType enum if it exists
    process_type_enum = postgresql.ENUM(ProcessType, name='processtype', create_type=False)
    process_type_enum.drop(op.get_bind(), checkfirst=True)
