import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from app.models import Base

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL is None:
    raise ValueError("DATABASE_URL environment variable is not set")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_create_table_sql(table_name, session):
    query = text("""
    SELECT 
        'CREATE TABLE ' || table_name || ' (' ||
        string_agg(
            CASE
                WHEN column_name = 'order' THEN 'position ' || data_type
                ELSE quote_ident(column_name) || ' ' || data_type
            END ||
            CASE 
                WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
                ELSE ''
            END ||
            CASE 
                WHEN is_nullable = 'NO' THEN ' NOT NULL'
                ELSE ''
            END,
            ', '
        ) || 
        ', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL' ||
        ', updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL' ||
        ');'
    FROM 
        information_schema.columns
    WHERE 
        table_schema = 'public' AND table_name = :table_name AND
        column_name NOT IN ('created_at', 'updated_at')
    GROUP BY 
        table_name;
    """)
    result = session.execute(query, {"table_name": table_name})
    return result.scalar()

def get_sequences(session):
    query = text("""
    SELECT 
        s.sequence_name,
        s.data_type,
        s.start_value::bigint,
        s.minimum_value::bigint,
        s.maximum_value::bigint,
        s.increment::bigint,
        COALESCE(ps.last_value::bigint, s.start_value::bigint) as last_value
    FROM 
        information_schema.sequences s
    LEFT JOIN
        pg_sequences ps ON s.sequence_name = ps.sequencename
    WHERE 
        s.sequence_schema = 'public';
    """)
    result = session.execute(query)
    return result.fetchall()

def generate_backup():
    inspector = inspect(engine)
    session = SessionLocal()

    try:
        with open("database_backup.sql", "w") as f:
            # Write initial setup
            f.write("--\n")
            f.write("-- PostgreSQL database dump\n")
            f.write("--\n\n")
            f.write("SET statement_timeout = 0;\n")
            f.write("SET lock_timeout = 0;\n")
            f.write("SET idle_in_transaction_session_timeout = 0;\n")
            f.write("SET client_encoding = 'UTF8';\n")
            f.write("SET standard_conforming_strings = on;\n")
            f.write("SELECT pg_catalog.set_config('search_path', '', false);\n")
            f.write("SET check_function_bodies = false;\n")
            f.write("SET xmloption = content;\n")
            f.write("SET client_min_messages = warning;\n")
            f.write("SET row_security = off;\n\n")
            f.write("SET default_tablespace = '';\n\n")
            f.write("SET default_table_access_method = heap;\n\n")

            # Create ENUM types
            f.write("-- Create ENUM types\n")
            f.write("CREATE TYPE process_type AS ENUM ('SEQUENTIAL', 'PARALLEL');\n\n")

            # Disable triggers
            f.write("-- Disable triggers\n")
            f.write("SET session_replication_role = replica;\n\n")

            # Get all tables
            tables = inspector.get_table_names()

            # Create sequences
            sequences = get_sequences(session)
            for seq in sequences:
                seq_name, data_type, start_value, min_value, max_value, increment, last_value = seq
                # Rename sequences for consistency
                if seq_name == 'prompttemplate_id_seq':
                    seq_name = 'prompt_template_id_seq'
                elif seq_name == 'chat_models_id_seq':
                    seq_name = 'chat_model_id_seq'
                f.write(f"CREATE SEQUENCE IF NOT EXISTS {seq_name}\n")
                f.write(f"    AS {data_type}\n")
                f.write(f"    START WITH {start_value}\n")
                f.write(f"    INCREMENT BY {increment}\n")
                f.write(f"    NO MINVALUE\n")
                f.write(f"    NO MAXVALUE\n")
                f.write(f"    CACHE 1;\n\n")

            # Create tables
            for table_name in tables:
                # Get table creation SQL
                table_def = get_create_table_sql(table_name, session)
                f.write(f"{table_def}\n\n")
                
                # Add trigger for updated_at
                f.write(f"CREATE TRIGGER set_{table_name}_updated_at\n")
                f.write(f"BEFORE UPDATE ON {table_name}\n")
                f.write(f"FOR EACH ROW\n")
                f.write(f"EXECUTE FUNCTION update_modified_column();\n\n")

            # Insert data
            for table_name in tables:
                columns = [column['name'] for column in inspector.get_columns(table_name) if column['name'] not in ['created_at', 'updated_at']]
                quoted_columns = [f'"{col}"' if col != 'order' else '"position"' for col in columns]
                
                # Check if the table has an 'id' column for ordering
                has_id = 'id' in columns
                order_by = 'ORDER BY id' if has_id else ''
                
                select_columns = ', '.join([f'"{col}"' if col != 'order' else '"order" as "position"' for col in columns])
                result = session.execute(text(f"SELECT {select_columns} FROM {table_name} {order_by}"))
                rows = result.fetchall()

                if rows:
                    f.write(f"-- Data for Name: {table_name}; Type: TABLE DATA;\n")
                    for row in rows:
                        values = [
                            'NULL' if value is None
                            else f"'{str(value).replace("'", "''")}'"
                            for value in row
                        ]
                        insert_statement = f"INSERT INTO {table_name} ({', '.join(quoted_columns)}) VALUES ({', '.join(values)});\n"
                        f.write(insert_statement)
                    f.write("\n")

            # Set sequence values
            for seq in sequences:
                seq_name, _, _, _, _, _, last_value = seq
                if seq_name == 'prompttemplate_id_seq':
                    seq_name = 'prompt_template_id_seq'
                elif seq_name == 'chat_models_id_seq':
                    seq_name = 'chat_model_id_seq'
                f.write(f"SELECT pg_catalog.setval('{seq_name}', {last_value}, true);\n")
            f.write("\n")

            # Add constraints and indexes
            for table_name in tables:
                constraints = inspector.get_check_constraints(table_name)
                for constraint in constraints:
                    f.write(f"ALTER TABLE {table_name} ADD CONSTRAINT ck_{table_name}_{constraint['name']} {constraint['sqltext']};\n")
                
                foreign_keys = inspector.get_foreign_keys(table_name)
                for fk in foreign_keys:
                    clean_table_name = table_name.replace('_', '')
                    clean_referred_table = fk['referred_table'].replace('_', '')
                    f.write(f"ALTER TABLE {table_name} ADD CONSTRAINT fk_{clean_table_name}_{clean_referred_table} FOREIGN KEY ({', '.join(fk['constrained_columns'])}) REFERENCES {fk['referred_table']} ({', '.join(fk['referred_columns'])});\n")
                
                indexes = inspector.get_indexes(table_name)
                for index in indexes:
                    if index['unique']:
                        f.write(f"ALTER TABLE {table_name} ADD CONSTRAINT uq_{table_name}_{index['name']} UNIQUE ({', '.join(index['column_names'])});\n")
                    else:
                        f.write(f"CREATE INDEX idx_{table_name}_{index['name']} ON {table_name} USING {index.get('postgresql_using', 'btree')} ({', '.join(index['column_names'])});\n")
                f.write("\n")

            # Add additional indexes for frequently queried columns
            f.write("-- Additional indexes for frequently queried columns\n")
            f.write("CREATE INDEX idx_workflow_step_workflow_id ON workflow_step (workflow_id);\n")
            f.write("CREATE INDEX idx_prompt_template_default_persona_id ON prompt_template (default_persona_id);\n")
            f.write("CREATE INDEX idx_chat_model_provider ON chat_model (provider);\n\n")

            # Create function for updating modified column
            f.write("-- Function to update modified column\n")
            f.write("CREATE OR REPLACE FUNCTION update_modified_column()\n")
            f.write("RETURNS TRIGGER AS $$\n")
            f.write("BEGIN\n")
            f.write("    NEW.updated_at = now();\n")
            f.write("    RETURN NEW;\n")
            f.write("END;\n")
            f.write("$$ language 'plpgsql';\n\n")

            # Enable triggers
            f.write("-- Enable triggers\n")
            f.write("SET session_replication_role = DEFAULT;\n")

        print("Backup generated successfully: database_backup.sql")

    except Exception as e:
        print(f"An error occurred: {str(e)}")
    finally:
        session.close()

if __name__ == "__main__":
    generate_backup()
