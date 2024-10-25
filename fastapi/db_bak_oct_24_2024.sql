--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

-- Create ENUM types
CREATE TYPE process_type AS ENUM ('SEQUENTIAL', 'HIERARCHICAL');

-- Disable triggers
SET session_replication_role = replica;

-- First create the trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$
 LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS persona_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS tool_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS prompt_template_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS tag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS chat_model_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS workflow_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS workflow_step_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE workflow_step (id integer NOT NULL, workflow_id integer, position integer NOT NULL, prompt_template_id integer, chat_model_id integer, persona_id integer, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TRIGGER set_workflow_step_updated_at
BEFORE UPDATE ON workflow_step
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

create table
  workflow (
    id integer not null,
    name character varying,
    description text,
    process_type process_type,
    created_at timestamp with time zone default current_timestamp not null,
    updated_at timestamp with time zone default current_timestamp not null,
    primary key (id)
  );

CREATE TRIGGER set_workflow_updated_at
BEFORE UPDATE ON workflow
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE persona (id integer NOT NULL, role character varying NOT NULL, goal character varying NOT NULL, backstory character varying NOT NULL, allow_delegation boolean NOT NULL, "verbose" boolean NOT NULL, memory boolean NOT NULL, avatar character varying, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, primary key (id));

CREATE TRIGGER set_persona_updated_at
BEFORE UPDATE ON persona
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE prompt_template (id integer NOT NULL, title character varying NOT NULL, prompt character varying NOT NULL, is_complex boolean NOT NULL, default_persona_id integer, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, primary key (id));

CREATE TRIGGER set_prompt_template_updated_at
BEFORE UPDATE ON prompt_template
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE category (id integer NOT NULL, name character varying NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, primary key (id));

CREATE TRIGGER set_category_updated_at
BEFORE UPDATE ON category
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE persona_category (persona_id integer NOT NULL, category_id integer NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TRIGGER set_persona_category_updated_at
BEFORE UPDATE ON persona_category
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE persona_tag (persona_id integer NOT NULL, tag_id integer NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TRIGGER set_persona_tag_updated_at
BEFORE UPDATE ON persona_tag
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE tag (id integer NOT NULL, name character varying NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, primary key (id));

CREATE TRIGGER set_tag_updated_at
BEFORE UPDATE ON tag
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE prompt_template_category (prompt_template_id integer NOT NULL, category_id integer NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TRIGGER set_prompt_template_category_updated_at
BEFORE UPDATE ON prompt_template_category
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE prompt_template_tag (prompt_template_id integer NOT NULL, tag_id integer NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TRIGGER set_prompt_template_tag_updated_at
BEFORE UPDATE ON prompt_template_tag
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE tool_persona (tool_id integer NOT NULL, persona_id integer NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TRIGGER set_tool_persona_updated_at
BEFORE UPDATE ON tool_persona
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE tool (id integer NOT NULL, name character varying NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, primary key (id));

CREATE TRIGGER set_tool_updated_at
BEFORE UPDATE ON tool
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE alembic_version (version_num character varying(32) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL);

CREATE TRIGGER set_alembic_version_updated_at
BEFORE UPDATE ON alembic_version
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TABLE chat_model (id integer NOT NULL, name character varying, model character varying, provider character varying, description character varying, api_key character varying, "default" boolean, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, primary key (id));

CREATE TRIGGER set_chat_model_updated_at
BEFORE UPDATE ON chat_model
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Data for Name: persona; Type: TABLE DATA;
INSERT INTO persona ("id", "role", "goal", "backstory", "allow_delegation", "verbose", "memory", "avatar") VALUES ('1', 'Senior Software Engineer', 'Develop efficient and scalable software solutions that don''t break.', 'You are a seasoned software engineer with 10 years of experience in various programming languages and frameworks. You specialize in backend development and system architecture.', 'True', 'True', 'True', NULL);
INSERT INTO persona ("id", "role", "goal", "backstory", "allow_delegation", "verbose", "memory", "avatar") VALUES ('2', 'Creative Writer', 'Craft engaging and imaginative stories that are fantastic.', 'You are a published author with a flair for creating vivid characters and intricate plots. Your writing spans multiple genres, including fantasy, science fiction, and mystery.', 'False', 'True', 'True', '');

-- Data for Name: category; Type: TABLE DATA;
INSERT INTO category ("id", "name") VALUES ('1', 'Software Development');
INSERT INTO category ("id", "name") VALUES ('2', 'Creative Writing');


-- Data for Name: chat_model; Type: TABLE DATA;
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('1', 'Perplexity Llama', 'perplexity/llama-3.1-sonar-huge-128k-online', 'openrouter', NULL, NULL, 'True');
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('2', 'GPT-4o', 'openai/chatgpt-4o-latest', 'openrouter', NULL, NULL, 'True');
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('3', 'Gemini 1.5 Pro', 'google/gemini-pro-1.5-exp', 'openrouter', NULL, NULL, 'True');
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('4', 'Meta Llama 3.1', 'meta-llama/llama-3.1-405b-instruct', 'openrouter', NULL, NULL, 'True');
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('5', 'Claude 3.5 Sonnet', 'anthropic/claude-3.5-sonnet', 'openrouter', NULL, NULL, 'True');
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('6', 'Mixtral 8x22B', 'mistralai/mixtral-8x22b-instruct', 'openrouter', NULL, NULL, 'True');
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('7', 'Mistral Large', 'mistralai/mistral-large', 'openrouter', NULL, NULL, 'True');
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('9', 'Zephyr 7B', 'huggingfaceh4/zephyr-7b-beta:free', 'openrouter', NULL, NULL, 'True');
INSERT INTO chat_model ("id", "name", "model", "provider", "description", "api_key", "default") VALUES ('10', 'O1 Mini', 'openai/o1-mini', 'openrouter', NULL, NULL, 'True');

SELECT pg_catalog.setval('persona_id_seq', 3, true);
SELECT pg_catalog.setval('category_id_seq', 3, true);
SELECT pg_catalog.setval('chat_model_id_seq', 11, true);

ALTER TABLE workflow_step ADD CONSTRAINT fk_workflowstep_chatmodel FOREIGN KEY (chat_model_id) REFERENCES chat_model (id);
ALTER TABLE workflow_step ADD CONSTRAINT fk_workflowstep_persona FOREIGN KEY (persona_id) REFERENCES persona (id);
ALTER TABLE workflow_step ADD CONSTRAINT fk_workflowstep_prompttemplate FOREIGN KEY (prompt_template_id) REFERENCES prompt_template (id);
ALTER TABLE workflow_step ADD CONSTRAINT fk_workflowstep_workflow FOREIGN KEY (workflow_id) REFERENCES workflow (id);
CREATE INDEX idx_workflow_step_ix_workflow_step_id ON workflow_step USING btree (id);

CREATE INDEX idx_workflow_ix_workflow_id ON workflow USING btree (id);
CREATE INDEX idx_workflow_ix_workflow_name ON workflow USING btree (name);

CREATE INDEX idx_persona_ix_persona_id ON persona USING btree (id);

ALTER TABLE prompt_template ADD CONSTRAINT fk_prompttemplate_persona FOREIGN KEY (default_persona_id) REFERENCES persona (id);
CREATE INDEX idx_prompt_template_ix_prompt_template_id ON prompt_template USING btree (id);

ALTER TABLE category ADD CONSTRAINT uq_category_category_name_key UNIQUE (name);
CREATE INDEX idx_category_ix_category_id ON category USING btree (id);

ALTER TABLE persona_category ADD CONSTRAINT fk_personacategory_category FOREIGN KEY (category_id) REFERENCES category (id);
ALTER TABLE persona_category ADD CONSTRAINT fk_personacategory_persona FOREIGN KEY (persona_id) REFERENCES persona (id);

ALTER TABLE persona_tag ADD CONSTRAINT fk_personatag_persona FOREIGN KEY (persona_id) REFERENCES persona (id);
ALTER TABLE persona_tag ADD CONSTRAINT fk_personatag_tag FOREIGN KEY (tag_id) REFERENCES tag (id);

CREATE INDEX idx_tag_ix_tag_id ON tag USING btree (id);
ALTER TABLE tag ADD CONSTRAINT uq_tag_tag_name_key UNIQUE (name);

ALTER TABLE prompt_template_category ADD CONSTRAINT fk_prompttemplatecategory_category FOREIGN KEY (category_id) REFERENCES category (id);
ALTER TABLE prompt_template_category ADD CONSTRAINT fk_prompttemplatecategory_prompttemplate FOREIGN KEY (prompt_template_id) REFERENCES prompt_template (id);

ALTER TABLE prompt_template_tag ADD CONSTRAINT fk_prompttemplatetag_prompttemplate FOREIGN KEY (prompt_template_id) REFERENCES prompt_template (id);
ALTER TABLE prompt_template_tag ADD CONSTRAINT fk_prompttemplatetag_tag FOREIGN KEY (tag_id) REFERENCES tag (id);

ALTER TABLE tool_persona ADD CONSTRAINT fk_toolpersona_persona FOREIGN KEY (persona_id) REFERENCES persona (id);
ALTER TABLE tool_persona ADD CONSTRAINT fk_toolpersona_tool FOREIGN KEY (tool_id) REFERENCES tool (id);

CREATE INDEX idx_tool_ix_tool_id ON tool USING btree (id);


CREATE INDEX idx_chat_model_ix_chat_model_id ON chat_model USING btree (id);
CREATE INDEX idx_chat_model_ix_chat_model_name ON chat_model USING btree (name);

-- Additional indexes for frequently queried columns
CREATE INDEX idx_workflow_step_workflow_id ON workflow_step (workflow_id);
CREATE INDEX idx_prompt_template_default_persona_id ON prompt_template (default_persona_id);
CREATE INDEX idx_chat_model_provider ON chat_model (provider);

-- Function to update modified column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Enable triggers
SET session_replication_role = DEFAULT;
