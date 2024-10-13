"""Add remaining tables

Revision ID: add_remaining_tables
Revises: combined_chatmodel_migration
Create Date: 2024-03-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_remaining_tables'
down_revision = 'combined_chatmodel_migration'
branch_labels = None
depends_on = None

def upgrade():
    # Create persona table
    op.create_table('persona',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('goal', sa.String(), nullable=False),
        sa.Column('backstory', sa.String(), nullable=False),
        sa.Column('allow_delegation', sa.Boolean(), nullable=False),
        sa.Column('verbose', sa.Boolean(), nullable=False),
        sa.Column('memory', sa.Boolean(), nullable=False),
        sa.Column('avatar', sa.String(), nullable=True),
        sa.Column('is_favorite', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create tool table
    op.create_table('tool',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create prompttemplate table
    op.create_table('prompttemplate',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('prompt', sa.String(), nullable=False),
        sa.Column('is_complex', sa.Boolean(), nullable=False),
        sa.Column('default_persona_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['default_persona_id'], ['persona.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create category table
    op.create_table('category',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create tag table
    op.create_table('tag',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create association tables
    op.create_table('persona_category',
        sa.Column('persona_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['category.id'], ),
        sa.ForeignKeyConstraint(['persona_id'], ['persona.id'], ),
        sa.PrimaryKeyConstraint('persona_id', 'category_id')
    )

    op.create_table('persona_tag',
        sa.Column('persona_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['persona_id'], ['persona.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['tag.id'], ),
        sa.PrimaryKeyConstraint('persona_id', 'tag_id')
    )

    op.create_table('prompt_template_category',
        sa.Column('prompt_template_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['category.id'], ),
        sa.ForeignKeyConstraint(['prompt_template_id'], ['prompttemplate.id'], ),
        sa.PrimaryKeyConstraint('prompt_template_id', 'category_id')
    )

    op.create_table('prompt_template_tag',
        sa.Column('prompt_template_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['prompt_template_id'], ['prompttemplate.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['tag.id'], ),
        sa.PrimaryKeyConstraint('prompt_template_id', 'tag_id')
    )

    op.create_table('tool_persona',
        sa.Column('tool_id', sa.Integer(), nullable=False),
        sa.Column('persona_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['persona_id'], ['persona.id'], ),
        sa.ForeignKeyConstraint(['tool_id'], ['tool.id'], ),
        sa.PrimaryKeyConstraint('tool_id', 'persona_id')
    )

def downgrade():
    op.drop_table('tool_persona')
    op.drop_table('prompt_template_tag')
    op.drop_table('prompt_template_category')
    op.drop_table('persona_tag')
    op.drop_table('persona_category')
    op.drop_table('tag')
    op.drop_table('category')
    op.drop_table('prompttemplate')
    op.drop_table('tool')
    op.drop_table('persona')
