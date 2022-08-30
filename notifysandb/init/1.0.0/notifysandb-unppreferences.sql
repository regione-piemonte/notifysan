--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.6
-- Dumped by pg_dump version 10.12

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

--
-- Name: unppreferences; Type: SCHEMA; Schema: -; Owner: unppreferences
--

CREATE SCHEMA unppreferences;


ALTER SCHEMA unppreferences OWNER TO unppreferences;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: broadcast; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.broadcast (
    uuid character varying(36) NOT NULL,
    name character varying(255),
    service character varying(255),
    scheduled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    status character varying(255) NOT NULL,
    mex text,
    token text
);


ALTER TABLE unppreferences.broadcast OWNER TO unppreferences;

--
-- Name: escape; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.escape (
    messaggio text NOT NULL
);


ALTER TABLE unppreferences.escape OWNER TO unppreferences;

--
-- Name: services; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--


CREATE TABLE unppreferences.services (
	uuid varchar(36) NOT NULL PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	channels varchar(255) NULL,
	tags text[] NULL,
	mex_enforced_tags varchar(255) NULL,
	description varchar(255) NULL
);

ALTER TABLE unppreferences.services OWNER TO unppreferences;

--
-- Name: users; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.users (
    user_id character varying(255) NOT NULL,
    sms character varying(30),
    phone character varying(30),
    email character varying(255),
    push text,
    language character varying(255),
    interests character varying(255)
);


ALTER TABLE unppreferences.users OWNER TO unppreferences;

--
-- Name: users2; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.users2 (
    user_id character varying(255) NOT NULL,
    sms character varying(30),
    phone character varying(30),
    email character varying(255),
    push text,
    language character varying(255),
    interests character varying(255)
);


ALTER TABLE unppreferences.users2 OWNER TO unppreferences;

--
-- Name: users_s; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.users_s (
    user_id character varying(255) NOT NULL,
    sms character varying(255),
    phone character varying(255),
    email character varying(255),
    push text,
    language character varying(255),
    interests character varying(255),
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE unppreferences.users_s OWNER TO unppreferences;

--
-- Name: users_services; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.users_services (
    uuid character varying(36) NOT NULL,
    user_id character varying(255) NOT NULL,
    service_name character varying(255) NOT NULL,
    channels character varying(255)
);


ALTER TABLE unppreferences.users_services OWNER TO unppreferences;

--
-- Name: users_services_s; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.users_services_s (
    uuid character varying(36) NOT NULL,
    user_id character varying(255) NOT NULL,
    service_name character varying(255) NOT NULL,
    channels character varying(255),
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE unppreferences.users_services_s OWNER TO unppreferences;

--
-- Name: users_terms; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.users_terms (
    user_id character varying(255) NOT NULL,
    accepted_at timestamp with time zone,
    hashed_terms character varying(255)
);


ALTER TABLE unppreferences.users_terms OWNER TO unppreferences;

--
-- Name: users_terms_s; Type: TABLE; Schema: unppreferences; Owner: unppreferences
--

CREATE TABLE unppreferences.users_terms_s (
    user_id character varying(255) NOT NULL,
    accepted_at timestamp with time zone,
    hashed_terms character varying(255),
    "timestamp" timestamp with time zone NOT NULL
);


ALTER TABLE unppreferences.users_terms_s OWNER TO unppreferences;

--
-- Name: broadcast idx_10515459_primary; Type: CONSTRAINT; Schema: unppreferences; Owner: unppreferences
--

ALTER TABLE ONLY unppreferences.broadcast
    ADD CONSTRAINT idx_10515459_primary PRIMARY KEY (uuid);


--
-- Name: services idx_10515524_primary; Type: CONSTRAINT; Schema: unppreferences; Owner: unppreferences
--

ALTER TABLE ONLY unppreferences.services
    ADD CONSTRAINT idx_10515524_primary PRIMARY KEY (uuid);


--
-- Name: users idx_10515567_primary; Type: CONSTRAINT; Schema: unppreferences; Owner: unppreferences
--

ALTER TABLE ONLY unppreferences.users
    ADD CONSTRAINT idx_10515567_primary PRIMARY KEY (user_id);


--
-- Name: users_s idx_10515691_primary; Type: CONSTRAINT; Schema: unppreferences; Owner: unppreferences
--

ALTER TABLE ONLY unppreferences.users_s
    ADD CONSTRAINT users_s_pk PRIMARY KEY (user_id, "timestamp");


--
-- Name: users_services idx_10515737_primary; Type: CONSTRAINT; Schema: unppreferences; Owner: unppreferences
--

ALTER TABLE ONLY unppreferences.users_services
    ADD CONSTRAINT idx_10515737_primary PRIMARY KEY (uuid);


--
-- Name: users_services_s idx_10515801_primary; Type: CONSTRAINT; Schema: unppreferences; Owner: unppreferences
--

ALTER TABLE ONLY unppreferences.users_services_s
    ADD CONSTRAINT idx_10515801_primary PRIMARY KEY (uuid, "timestamp");


--
-- Name: users_terms idx_10515853_primary; Type: CONSTRAINT; Schema: unppreferences; Owner: unppreferences
--

ALTER TABLE ONLY unppreferences.users_terms
    ADD CONSTRAINT idx_10515853_primary PRIMARY KEY (user_id);


--
-- Name: users_terms_s idx_10515908_primary; Type: CONSTRAINT; Schema: unppreferences; Owner: unppreferences
--

ALTER TABLE ONLY unppreferences.users_terms_s
    ADD CONSTRAINT idx_10515908_primary PRIMARY KEY (user_id, "timestamp");


--
-- Name: idx_10515524_name; Type: INDEX; Schema: unppreferences; Owner: unppreferences
--

CREATE UNIQUE INDEX idx_10515524_name ON unppreferences.services USING btree (name);


--
-- Name: idx_10515524_tags_ft_index; Type: INDEX; Schema: unppreferences; Owner: unppreferences
--

CREATE INDEX idx_10515524_tags_ft_index ON unppreferences.services USING gin (to_tsvector('simple'::regconfig, tags));


--
-- Name: idx_10515737_user_id; Type: INDEX; Schema: unppreferences; Owner: unppreferences
--

CREATE UNIQUE INDEX idx_10515737_user_id ON unppreferences.users_services USING btree (user_id, service_name);


--
-- PostgreSQL database dump complete
--
CREATE TABLE unppreferences.broadcast_batch (
    uuid character varying(36) PRIMARY KEY,
    fiscal_code character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    stato character varying(255) NOT NULL,
    full_message text,
    full_message_sent text,
    token text,
    flag_not_to_send BOOLEAN NOT NULL,
    correlation_id character varying(36),
    telephone character varying(255),
    email character varying(255),
    push BOOLEAN
);

CREATE TABLE unppreferences.broadcast_batch_s (
    uuid character varying(36) PRIMARY KEY,
    fiscal_code character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    stato character varying(255) NOT NULL,
    full_message text,
    full_message_sent text,
    token text,
    flag_not_to_send BOOLEAN NOT NULL,
    correlation_id character varying(36),
    telephone character varying(255),
    email character varying(255),
    push BOOLEAN
);

ALTER TABLE unppreferences.broadcast_batch OWNER TO unppreferences;

ALTER TABLE unppreferences.broadcast_batch_s OWNER TO unppreferences;

CREATE TABLE unppreferences.batch_config (
    id SERIAL PRIMARY KEY,
    code character varying(255),
    valore  character varying(255)
);

INSERT INTO unppreferences.batch_config
(id, code, valore)
VALUES(1, 'MESSAGE_HIST', '180');
INSERT INTO unppreferences.batch_config
(id, code, valore)
VALUES(2, 'MESSAGE_DELETE', '3550');
INSERT INTO unppreferences.batch_config
(id, code, valore)
VALUES(3, 'BROADCAST_HIST', '60');
INSERT INTO unppreferences.batch_config
(id, code, valore)
VALUES(4, 'BROADCAST_DELETE', '3550');

ALTER TABLE unppreferences.batch_config OWNER TO unppreferences;

ALTER TABLE unppreferences.broadcast_batch add column push_token text;

ALTER TABLE unppreferences.broadcast_batch drop column push;

ALTER TABLE unppreferences.broadcast_batch_s add column push_token text;

ALTER TABLE unppreferences.broadcast_batch_s drop column push;


CREATE TABLE unppreferences.semaforo (
    uuid character varying(255) PRIMARY KEY,
    channel  character varying(255)
);

ALTER TABLE unppreferences.semaforo OWNER TO unppreferences;

ALTER TABLE semaforo ADD COLUMN created_at TIMESTAMP;
ALTER TABLE semaforo ALTER COLUMN created_at SET DEFAULT now();