--
-- PostgreSQL database dump
--

-- Dumped from database version 17.0
-- Dumped by pg_dump version 17.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.category (
    id integer NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.category OWNER TO postgres;

--
-- Name: category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.category_id_seq OWNER TO postgres;

--
-- Name: category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.category_id_seq OWNED BY public.category.id;


--
-- Name: chat_model; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_model (
    id integer NOT NULL,
    name character varying,
    model character varying,
    provider character varying,
    description character varying,
    api_key character varying,
    "default" boolean
);


ALTER TABLE public.chat_model OWNER TO postgres;

--
-- Name: chat_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_models_id_seq OWNER TO postgres;

--
-- Name: chat_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_models_id_seq OWNED BY public.chat_model.id;


--
-- Name: persona; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persona (
    id integer NOT NULL,
    role character varying NOT NULL,
    goal character varying NOT NULL,
    backstory character varying NOT NULL,
    allow_delegation boolean NOT NULL,
    "verbose" boolean NOT NULL,
    memory boolean NOT NULL,
    avatar character varying,
    is_favorite boolean
);


ALTER TABLE public.persona OWNER TO postgres;

--
-- Name: persona_category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persona_category (
    persona_id integer NOT NULL,
    category_id integer NOT NULL
);


ALTER TABLE public.persona_category OWNER TO postgres;

--
-- Name: persona_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.persona_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.persona_id_seq OWNER TO postgres;

--
-- Name: persona_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.persona_id_seq OWNED BY public.persona.id;


--
-- Name: persona_tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persona_tag (
    persona_id integer NOT NULL,
    tag_id integer NOT NULL
);


ALTER TABLE public.persona_tag OWNER TO postgres;

--
-- Name: prompt_template; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prompt_template (
    id integer NOT NULL,
    title character varying NOT NULL,
    prompt character varying NOT NULL,
    is_complex boolean NOT NULL,
    default_persona_id integer
);


ALTER TABLE public.prompt_template OWNER TO postgres;

--
-- Name: prompt_template_category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prompt_template_category (
    prompt_template_id integer NOT NULL,
    category_id integer NOT NULL
);


ALTER TABLE public.prompt_template_category OWNER TO postgres;

--
-- Name: prompt_template_tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prompt_template_tag (
    prompt_template_id integer NOT NULL,
    tag_id integer NOT NULL
);


ALTER TABLE public.prompt_template_tag OWNER TO postgres;

--
-- Name: prompttemplate_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.prompttemplate_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.prompttemplate_id_seq OWNER TO postgres;

--
-- Name: prompttemplate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.prompttemplate_id_seq OWNED BY public.prompt_template.id;


--
-- Name: tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tag (
    id integer NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.tag OWNER TO postgres;

--
-- Name: tag_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tag_id_seq OWNER TO postgres;

--
-- Name: tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tag_id_seq OWNED BY public.tag.id;


--
-- Name: tool; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tool (
    id integer NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.tool OWNER TO postgres;

--
-- Name: tool_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tool_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tool_id_seq OWNER TO postgres;

--
-- Name: tool_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tool_id_seq OWNED BY public.tool.id;


--
-- Name: tool_persona; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tool_persona (
    tool_id integer NOT NULL,
    persona_id integer NOT NULL
);


ALTER TABLE public.tool_persona OWNER TO postgres;

--
-- Name: category id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category ALTER COLUMN id SET DEFAULT nextval('public.category_id_seq'::regclass);


--
-- Name: chat_model id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_model ALTER COLUMN id SET DEFAULT nextval('public.chat_models_id_seq'::regclass);


--
-- Name: persona id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persona ALTER COLUMN id SET DEFAULT nextval('public.persona_id_seq'::regclass);


--
-- Name: prompt_template id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template ALTER COLUMN id SET DEFAULT nextval('public.prompttemplate_id_seq'::regclass);


--
-- Name: tag id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag ALTER COLUMN id SET DEFAULT nextval('public.tag_id_seq'::regclass);


--
-- Name: tool id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool ALTER COLUMN id SET DEFAULT nextval('public.tool_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alembic_version (version_num) FROM stdin;
\.


--
-- Data for Name: category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.category (id, name) FROM stdin;
1	Software Development
2	Creative Writing
3	Data Science
\.


--
-- Data for Name: chat_model; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_model (id, name, model, provider, description, api_key, "default") FROM stdin;
1	Perplexity Llama	perplexity/llama-3.1-sonar-huge-128k-online	openrouter	\N	\N	t
2	GPT-4o	openai/chatgpt-4o-latest	openrouter	\N	\N	t
3	Gemini 1.5 Pro	google/gemini-pro-1.5-exp	openrouter	\N	\N	t
4	Meta Llama 3.1	meta-llama/llama-3.1-405b-instruct	openrouter	\N	\N	t
5	Claude 3.5 Sonnet	anthropic/claude-3.5-sonnet	openrouter	\N	\N	t
6	Mixtral 8x22B	mistralai/mixtral-8x22b-instruct	openrouter	\N	\N	t
7	Mistral Large	mistralai/mistral-large	openrouter	\N	\N	t
9	Zephyr 7B	huggingfaceh4/zephyr-7b-beta:free	openrouter	\N	\N	t
10	O1 Mini	openai/o1-mini	openrouter	\N	\N	t
\.


--
-- Data for Name: persona; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.persona (id, role, goal, backstory, allow_delegation, "verbose", memory, avatar, is_favorite) FROM stdin;
1	Senior Software Engineer	Develop efficient and scalable software solutions	You are a seasoned software engineer with 10 years of experience in various programming languages and frameworks. You specialize in backend development and system architecture.	t	t	t	\N	f
2	Creative Writer	Craft engaging and imaginative stories that are fantastic.	You are a published author with a flair for creating vivid characters and intricate plots. Your writing spans multiple genres, including fantasy, science fiction, and mystery.	f	t	t		t
\.


--
-- Data for Name: persona_category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.persona_category (persona_id, category_id) FROM stdin;
1	1
1	3
2	2
\.


--
-- Data for Name: persona_tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.persona_tag (persona_id, tag_id) FROM stdin;
1	1
1	2
2	3
2	5
\.


--
-- Data for Name: prompt_template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prompt_template (id, title, prompt, is_complex, default_persona_id) FROM stdin;
1	Code Review	Please review the following code snippet: {code}	f	1
2	Story Outline	Create a brief outline for a story with the following theme: {theme}	t	2
3	Recipe for Two	{"variables":[{"fieldName":"Ingredient 1","required":false,"controlType":"text"},{"fieldName":"Ingredient 2","required":false,"controlType":"text"}],"prompt":"I nee  a tasty recipe that combines {Ingredient 1} and {Ingredient 2}."}	t	\N
4	Joke	Tell me a joke	f	\N
\.


--
-- Data for Name: prompt_template_category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prompt_template_category (prompt_template_id, category_id) FROM stdin;
1	1
2	2
3	2
4	2
\.


--
-- Data for Name: prompt_template_tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prompt_template_tag (prompt_template_id, tag_id) FROM stdin;
1	4
2	3
2	5
3	6
4	7
\.


--
-- Data for Name: tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tag (id, name) FROM stdin;
1	Python
2	JavaScript
3	Writing
4	Code Review
5	Story
6	Food
7	joke
\.


--
-- Data for Name: tool; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tool (id, name) FROM stdin;
1	Python
2	JavaScript
3	Docker
4	Kubernetes
5	Word Processor
6	Thesaurus
7	Plot Outlining Tool
\.


--
-- Data for Name: tool_persona; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tool_persona (tool_id, persona_id) FROM stdin;
1	1
2	1
3	1
4	1
5	2
6	2
7	2
\.


--
-- Name: category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.category_id_seq', 3, true);


--
-- Name: chat_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_models_id_seq', 10, true);


--
-- Name: persona_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.persona_id_seq', 5, true);


--
-- Name: prompttemplate_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.prompttemplate_id_seq', 4, true);


--
-- Name: tag_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tag_id_seq', 7, true);


--
-- Name: tool_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tool_id_seq', 7, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: category category_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_name_key UNIQUE (name);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: chat_model chat_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_model
    ADD CONSTRAINT chat_models_pkey PRIMARY KEY (id);


--
-- Name: persona_category persona_category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persona_category
    ADD CONSTRAINT persona_category_pkey PRIMARY KEY (persona_id, category_id);


--
-- Name: persona persona_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persona
    ADD CONSTRAINT persona_pkey PRIMARY KEY (id);


--
-- Name: persona_tag persona_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persona_tag
    ADD CONSTRAINT persona_tag_pkey PRIMARY KEY (persona_id, tag_id);


--
-- Name: prompt_template_category prompt_template_category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template_category
    ADD CONSTRAINT prompt_template_category_pkey PRIMARY KEY (prompt_template_id, category_id);


--
-- Name: prompt_template_tag prompt_template_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template_tag
    ADD CONSTRAINT prompt_template_tag_pkey PRIMARY KEY (prompt_template_id, tag_id);


--
-- Name: prompt_template prompttemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template
    ADD CONSTRAINT prompttemplate_pkey PRIMARY KEY (id);


--
-- Name: tag tag_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_name_key UNIQUE (name);


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- Name: tool_persona tool_persona_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_persona
    ADD CONSTRAINT tool_persona_pkey PRIMARY KEY (tool_id, persona_id);


--
-- Name: tool tool_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT tool_pkey PRIMARY KEY (id);


--
-- Name: ix_chat_models_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_models_id ON public.chat_model USING btree (id);


--
-- Name: ix_chat_models_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_models_name ON public.chat_model USING btree (name);


--
-- Name: persona_category persona_category_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persona_category
    ADD CONSTRAINT persona_category_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.category(id);


--
-- Name: persona_category persona_category_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persona_category
    ADD CONSTRAINT persona_category_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id);


--
-- Name: persona_tag persona_tag_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persona_tag
    ADD CONSTRAINT persona_tag_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id);


--
-- Name: persona_tag persona_tag_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persona_tag
    ADD CONSTRAINT persona_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id);


--
-- Name: prompt_template_category prompt_template_category_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template_category
    ADD CONSTRAINT prompt_template_category_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.category(id);


--
-- Name: prompt_template_category prompt_template_category_prompt_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template_category
    ADD CONSTRAINT prompt_template_category_prompt_template_id_fkey FOREIGN KEY (prompt_template_id) REFERENCES public.prompt_template(id);


--
-- Name: prompt_template_tag prompt_template_tag_prompt_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template_tag
    ADD CONSTRAINT prompt_template_tag_prompt_template_id_fkey FOREIGN KEY (prompt_template_id) REFERENCES public.prompt_template(id);


--
-- Name: prompt_template_tag prompt_template_tag_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template_tag
    ADD CONSTRAINT prompt_template_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id);


--
-- Name: prompt_template prompttemplate_default_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompt_template
    ADD CONSTRAINT prompttemplate_default_persona_id_fkey FOREIGN KEY (default_persona_id) REFERENCES public.persona(id);


--
-- Name: tool_persona tool_persona_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_persona
    ADD CONSTRAINT tool_persona_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id);


--
-- Name: tool_persona tool_persona_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_persona
    ADD CONSTRAINT tool_persona_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool(id);


--
-- PostgreSQL database dump complete
--

